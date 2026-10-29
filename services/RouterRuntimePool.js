'use strict';
class RouterRuntimePool {
  constructor({ createRuntime, maxRuntimes = 100 } = {}) {
    if (typeof createRuntime !== 'function') throw new TypeError('RouterRuntimePool requires createRuntime(router).');
    if (!Number.isInteger(maxRuntimes) || maxRuntimes < 1) throw new TypeError('RouterRuntimePool maxRuntimes must be a positive integer.');
    this.createRuntime=createRuntime;
    this.maxRuntimes=maxRuntimes;
    this.runtimes=new Map();
    this.pending=new Map();
    this.closing=false;
    this.closePromise=null;
  }

  async getRuntime(router) {
    if(this.closing) throw new Error('Router runtime pool is shutting down.');
    if(!router||router.id==null||String(router.id).trim()==='') throw new TypeError('A persisted router ID is required.');
    const key=String(router.id);
    if(this.runtimes.has(key)) return this.runtimes.get(key);
    if(this.pending.has(key)) return this.pending.get(key);
    if(this.runtimes.size+this.pending.size>=this.maxRuntimes) throw new Error('Router runtime capacity reached ('+this.maxRuntimes+').');

    const creation=Promise.resolve().then(()=>this.createRuntime(router)).then(async runtime=>{
      if(!runtime||typeof runtime!=='object') throw new TypeError('Invalid runtime returned for router '+key+'.');
      if(this.closing){
        if(typeof runtime.close!=='function') throw new TypeError('Runtime '+key+' created during shutdown has no close().');
        await runtime.close();
        const error=new Error('Pool closed while router '+key+' was initializing.');
        error.code='ERR_ROUTER_RUNTIME_POOL_CLOSING';
        throw error;
      }
      this.runtimes.set(key,runtime);
      return runtime;
    }).catch(error=>{
      console.error('[RouterRuntimePool] Runtime creation failed',{routerId:key,message:error?.message||String(error)});
      throw error;
    }).finally(()=>{
      if(this.pending.get(key)===creation)this.pending.delete(key);
    });
    this.pending.set(key,creation);
    return creation;
  }

  async closeAll() {
    if(this.closePromise)return this.closePromise;
    this.closing=true;
    this.closePromise=(async()=>{
      const errors=[];
      const pending=await Promise.allSettled([...this.pending.values()]);
      for(const item of pending) {
        if(item.status==='rejected'&&item.reason?.code!=='ERR_ROUTER_RUNTIME_POOL_CLOSING') errors.push(item.reason);
      }
      const entries=[...this.runtimes.entries()];
      this.runtimes.clear();
      const results=await Promise.allSettled(entries.map(async([id,runtime])=>{
        if(typeof runtime.close!=='function') throw new TypeError('Runtime '+id+' does not implement close().');
        await runtime.close();
      }));
      results.forEach((item,index)=>{
        if(item.status==='rejected') errors.push(new Error('Failed to close router runtime '+entries[index][0]+': '+(item.reason?.message||String(item.reason))));
      });
      if(errors.length) throw new AggregateError(errors,'One or more router runtimes failed to shut down cleanly.');
    })();
    return this.closePromise;
  }
}
module.exports=RouterRuntimePool;
