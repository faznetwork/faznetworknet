const test=require("node:test");
const assert=require("node:assert/strict");
const {parseSms,extractWebhookPayload,extractAmount,extractTransactionId}=require("../services/paymentWebhookParser");

test("parses bKash JSON gateway payload",()=>{
  const result=parseSms(
    {sender:"bKash",message:"You have received Tk 50.00 from 017XXXXXXXX. Ref . TrxID 9A72BXC91 at 09/10/2026 03:30"},
    {},
    {"x-webhook-token":"secret"}
  );
  assert.equal(result.channel,"bkash");
  assert.equal(result.amount,50);
  assert.equal(result.trxId,"9A72BXC91");
});

test("parses url/query-forwarded SMS payload",()=>{
  const result=parseSms(
    {sms:"Money received Amount: Tk 75.50 Sender: 01712345678 TxnID: 71ABC12345"},
    {token:"secret"},
    {"x-sms-sender":"Nagad"}
  );
  assert.equal(result.channel,"nagad");
  assert.equal(result.amount,75.5);
  assert.equal(result.trxId,"71ABC12345");
  assert.equal(result.senderPhone,"01712345678");
});

test("parses Rocket cash-in format",()=>{
  const result=parseSms(
    {text:"Cash in from 01812345678 to 01912345678 Tk 100.00 successful. TxnId: RX123456789"},
    {},
    {"x-sms-sender":"DBBL"},
    {recipientNumbers:{rocket:"01912345678"}}
  );
  assert.equal(result.channel,"rocket");
  assert.equal(result.amount,100);
  assert.equal(result.trxId,"RX123456789");
});

test("supports generic body field and query token",()=>{
  const payload=extractWebhookPayload(
    {body:"Payment Tk 200.00 TrxID UP12345678",from:"01912345678"},
    {token:"secret"},
    {}
  );
  assert.equal(payload.text,"Payment Tk 200.00 TrxID UP12345678");
  assert.equal(payload.sender,"01912345678");
  assert.equal(payload.token,"secret");
  assert.equal(extractAmount(payload.text),200);
  assert.equal(extractTransactionId(payload.text),"UP12345678");
});

test("normalizes punctuation, commas and decimal amounts",()=>{
  assert.equal(extractAmount("You received amount: Tk 1,250.50"),1250.5);
  assert.equal(extractTransactionId("TrxID:  ABC-12345678."),"ABC-12345678");
});

test("rejects payloads without a transaction id or amount",()=>{
  assert.throws(()=>parseSms({sender:"bKash",message:"Payment received successfully"}, {}, {}),/Could not parse transaction ID or amount/);
});


test("rejects personal phone numbers as forwarding sender metadata",()=>{
  assert.throws(
    ()=>parseSms({sender:"01712345678",message:"Received Tk 50.00 TrxID ABC1234567"}, {}, {}),
    error=>error.code==="UNTRUSTED_FORWARDER_SENDER"&&error.statusCode===403
  );
});

test("does not infer MFS channel from SMS body when sender is not allowlisted",()=>{
  assert.throws(
    ()=>parseSms({sender:"UnknownSender",message:"bKash received Tk 50.00 TrxID ABC1234567"}, {}, {}),
    error=>error.code==="UNTRUSTED_FORWARDER_SENDER"
  );
});

test("rejects a present recipient that differs from configured wallet",()=>{
  assert.throws(
    ()=>parseSms({sender:"bKash",recipient:"01911112222",message:"Received Tk 50.00 TrxID ABC1234567"}, {}, {}, {recipientNumbers:{bkash:"01711112222"}}),
    error=>error.code==="INVALID_RECIPIENT"&&error.statusCode===403
  );
});

test("normalizes TrxID to uppercase and accepts only allowlisted service sender",()=>{
  const result=parseSms({sender:"16247",message:"Received Tk 50.00 TrxID abc1234567"}, {}, {});
  assert.equal(result.channel,"bkash");
  assert.equal(result.trxId,"ABC1234567");
});

test("parses bKash 10 BDT SMS with fee and balance without confusing amounts",()=>{
  const result=parseSms({sender:"bKash",message:"You have received Tk 10.00 from 01712345678. Fee Tk 0.00. Balance Tk 25.50. TrxID ABC123XYZ9."},{},{});
  assert.equal(result.amount,10);
  assert.equal(result.trxId,"ABC123XYZ9");
});
test("parses Nagad wording with amount before currency and TxnID",()=>{
  const result=parseSms({sender:"16167",sms:"Money received 10.00 BDT from 01812345678. Charge: 0.00 BDT. Available Balance: 110.00 BDT. TxnID NAGAD123456"},{},{});
  assert.equal(result.channel,"nagad");
  assert.equal(result.amount,10);
  assert.equal(result.trxId,"NAGAD123456");
});
test("parses Rocket and Upay transaction reference variants",()=>{
  const rocket=parseSms({sender:"DBBL",message:"Cash In 10 BDT from 01812345678. Fee 0.00 Tk. Balance 30.00 Tk. Transaction ID: RKT12345678"},{},{});
  const upay=parseSms({sender:"upay",message:"Payment received. Amount: BDT 10.00. Fee: BDT 0.00. Balance: BDT 50.00. Trx ID=UPY12345678"},{},{});
  assert.equal(rocket.amount,10);
  assert.equal(rocket.trxId,"RKT12345678");
  assert.equal(upay.amount,10);
  assert.equal(upay.trxId,"UPY12345678");
});
test("accepts Bangla digits and MacroDroid text fields",()=>{
  assert.equal(extractAmount("Received ১০.০০ Tk. Fee ০.০০ Tk. Balance ২০.০০ Tk"),10);
  assert.equal(extractTransactionId("TrxID: ABC1234567"),"ABC1234567");
});


test("accepts configured custom sender shortcodes without guessing channel from SMS text",()=>{
  const result=parseSms(
    {sender:"MFS-BKASH-CUSTOM",message:"Received Tk 25.00 from 01712345678. TrxID CUSTOM123456"},
    {},
    {},
    {senderIdentifiers:{bkash:["MFS-BKASH-CUSTOM"],nagad:["NAGAD-CUSTOM"],rocket:["ROCKET-CUSTOM"],upay:["UPAY-CUSTOM"]}}
  );
  assert.equal(result.channel,"bkash");
  assert.equal(result.amount,25);
  assert.equal(result.trxId,"CUSTOM123456");
});

test("accepts MacroDroid sms_body and sender_id field names",()=>{
  const result=parseSms(
    {sender_id:"16247",sms_body:"You have received Tk 35.00 from 01712345678. TrxID MACRO123456"},
    {},
    {},
    {}
  );
  assert.equal(result.channel,"bkash");
  assert.equal(result.amount,35);
  assert.equal(result.trxId,"MACRO123456");
});
