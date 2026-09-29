import { Parser } from '@traqula/parser-sparql-1-1'
import { Generator } from '@traqula/generator-sparql-1-1'

export const QUERY_ROW_LIMIT=100
const parser=new Parser({lexerConfig:{positionTracking:'full'}})
export function syntaxError(error,query){
  const message=String(error?.message||'')
  const positioned=message.match(/on line (\d+)\n[^\n]*\n(-*)\^/)
  let offset
  if(!positioned){
    const lexer=message.match(/offset:\s*(\d+)/i)
    const prefix=message.match(/Unknown prefix: ([\w-]+)/)
    if(lexer) offset=Number(lexer[1])
    else if(prefix) offset=query.indexOf(`${prefix[1]}:`)
    else if(message.includes("but found: ''")) offset=query.length
  }
  const before=Number.isInteger(offset)&&offset>=0?query.slice(0,offset):null
  return Object.assign(new Error('QUERY_SYNTAX'),{
    line:positioned?Number(positioned[1]):before!==null?before.split('\n').length:null,
    column:positioned?positioned[2].length+1:before!==null?before.length-before.lastIndexOf('\n'):null,
    reason:message.startsWith('Unknown prefix:')?'UNKNOWN_PREFIX':'SYNTAX',
  })
}
export function prepareReadOnlyQuery(query){
  if(typeof query!=='string'||!query.trim()) throw new Error('QUERY_EMPTY')
  if(query.length>6000) throw new Error('QUERY_TOO_LONG')
  let ast
  try{ast=parser.parse(query)}catch(error){throw syntaxError(error,query)}
  if(ast.type!=='query'||!['select','ask'].includes(ast.subType)) throw new Error('QUERY_READ_ONLY')
  let count=0
  const walk=node=>{
    if(!node||typeof node!=='object') return
    if(++count>2500) throw new Error('QUERY_TOO_COMPLEX')
    if(node.subType==='service'||(node.type==='datasetClauses'&&node.clauses.length)) throw new Error('QUERY_LOCAL_ONLY')
    for(const value of Object.values(node)) if(typeof value==='object') walk(value)
  }
  walk(ast)
  if(ast.subType==='select'){
    const old=ast.solutionModifiers.limitOffset||{}
    ast.solutionModifiers.limitOffset={...old,type:'solutionModifier',subType:'limitOffset',limit:Math.min(old.limit??QUERY_ROW_LIMIT+1,QUERY_ROW_LIMIT+1),loc:{sourceLocationType:'autoGenerate'}}
  }
  return {query:new Generator().generate(ast),kind:ast.subType}
}

export function executeReadOnlyQuery(Store,dataset,query){
  const safe=prepareReadOnlyQuery(query)
  const serialized=JSON.stringify(dataset)
  if(serialized.length>2000000) throw new Error('DATASET_TOO_LARGE')
  const store=new Store()
  try{
    store.load(serialized,{format:'application/ld+json'})
    const result=JSON.parse(store.query(safe.query,{results_format:'json',use_default_graph_as_union:true}))
    if(safe.kind==='ask') return {kind:'ask',value:result.boolean}
    const rows=result.results.bindings
    return {kind:'select',columns:result.head.vars,rows:rows.slice(0,QUERY_ROW_LIMIT),truncated:rows.length>QUERY_ROW_LIMIT}
  }finally{store.free()}
}
