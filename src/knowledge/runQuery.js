// A disposable worker bounds execution and releases the personal dataset.
export function startLocalQuery(dataset,query,{timeout=12000}={}){
  const worker=new Worker(new URL('./query.worker.js',import.meta.url),{type:'module'})
  let rejectRun
  let finished=false
  let timer
  const finish=()=>{finished=true;clearTimeout(timer);worker.terminate()}
  const promise=new Promise((resolve,reject)=>{
    rejectRun=reject
    timer=setTimeout(()=>{finish();reject(new Error('QUERY_TIMEOUT'))},timeout)
    worker.onmessage=({data})=>{finish();data.error?reject(new Error(data.error)):resolve(data.result)}
    worker.onerror=()=>{finish();reject(new Error('QUERY_FAILED'))}
    worker.postMessage({dataset,query})
  })
  return {promise,cancel(){if(!finished){finish();rejectRun(new Error('QUERY_CANCELLED'))}}}
}
