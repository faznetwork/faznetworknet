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
    {"x-sms-sender":"DBBL Rocket"}
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
