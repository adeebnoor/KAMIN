// CSV follows RFC 4180 quoting; spreadsheet formula prefixes are neutralised.
// JSON remains the lossless SPARQL bindings export (types/languages included).
const csvCell=value=>{
  let text=String(value??'')
  if(/^[\s\u0000-\u001f]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text=`'${text}`
  return `"${text.replaceAll('"','""')}"`
}
export function resultsToCsv(result){
  if(result?.kind==='ask')return `"boolean"\r\n"${result.value?'true':'false'}"\r\n`
  if(result?.kind!=='select'||!Array.isArray(result.columns)||!Array.isArray(result.rows))throw new Error('INVALID_QUERY_RESULT')
  return [result.columns.map(csvCell).join(','),...result.rows.map(row=>result.columns.map(c=>csvCell(row[c]?.value)).join(','))].join('\r\n')+'\r\n'
}
export function exportDataset(Store,quad,defaultGraph,dataset,format='turtle'){
  if(!['turtle','trig'].includes(format))throw new Error('INVALID_RDF_FORMAT')
  const serialized=JSON.stringify(dataset)
  if(serialized.length>2000000)throw new Error('DATASET_TOO_LARGE')
  const store=new Store()
  let union
  try{
    store.load(serialized,{format:'application/ld+json'})
    if(format==='trig')return store.dump({format:'application/trig'})
    // Turtle represents a graph, not a dataset. Explicitly export the union;
    // TriG is offered alongside it for lossless named-graph provenance.
    union=new Store()
    for(const item of store.match())union.add(quad(item.subject,item.predicate,item.object,defaultGraph()))
    return '# Kamin: union of the selected dataset. Graph names omitted; use TriG to preserve them.\n'+union.dump({format:'text/turtle',from_graph_name:defaultGraph()})
  }finally{union?.free();store.free()}
}
