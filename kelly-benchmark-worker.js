/* 100,000-path Kelly benchmark cells run here, away from the UI thread.
   One message in = one (firm preset, Kelly ratio) spec from KellyRules.benchSpec(); one message out = its summary. */
importScripts('prop-rules.js','kelly-rules-matrix.js');
self.onmessage=({data:spec})=>{
  try{
    const result=KellyRules.benchFinish(spec,KellyRules.benchRun(spec));
    self.postMessage({id:spec.id,ratioIndex:spec.ratioIndex,result});
  }catch(err){self.postMessage({id:spec.id,ratioIndex:spec.ratioIndex,error:err.message});}
};
