export class ProjectGraph {
  constructor(){this.nodes=new Map();}
  add(name,{deps=[],command=null}={}){ if(this.nodes.has(name)) throw new Error(`duplicate project: ${name}`); this.nodes.set(name,{name,deps:[...deps],command}); return this; }
  order(targets=[...this.nodes.keys()]){ const out=[],temp=new Set(),done=new Set(); const visit=n=>{ if(done.has(n))return;if(temp.has(n))throw new Error(`cycle at ${n}`);const node=this.nodes.get(n);if(!node)throw new Error(`unknown project: ${n}`);temp.add(n);for(const d of node.deps)visit(d);temp.delete(n);done.add(n);out.push(n);}; for(const t of targets)visit(t); return out; }
  plan(targets){ return this.order(targets).map(name=>this.nodes.get(name)).filter(n=>n.command); }
}
export const defineWorkspace=config=>{ const g=new ProjectGraph(); for(const [name,spec] of Object.entries(config.projects??{})) g.add(name,spec); return g; };
