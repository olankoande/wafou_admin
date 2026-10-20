import { useCallback, useEffect, useRef, useState } from 'react';

export function previewErrorMessage(error:unknown):string {
 const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
 if(code==='42501')return 'app.errors.accessDenied';
 return typeof code==='string'&&/^(22|23)/.test(code)?'billing.errors.invalid':'app.errors.requestFailed';
}

/** Invalidate displayed prices and in-flight responses whenever the composition changes. */
export function usePreviewState<T>() {
 const [result,setResult]=useState<T|null>(null);
 const [loading,setLoading]=useState(false);
 const generation=useRef(0);
 const invalidate=useCallback(()=>{generation.current++;setResult(null);},[]);
 async function run(request:()=>Promise<T>,onError:(error:unknown)=>void) {
  const current=++generation.current;
  setLoading(true);setResult(null);
  try {
   const data=await request();
   if(current===generation.current)setResult(data);
  } catch(error) {
   if(current===generation.current)onError(error);
  } finally {setLoading(false);}
 }
 useEffect(()=>()=>{generation.current++;},[]);
 return {result,loading,invalidate,run};
}

export function PreviewFormObserver({data,onChange}:{data:Record<string,unknown>;onChange:()=>void}) {
 const fingerprint=JSON.stringify(data);
 useEffect(onChange,[fingerprint,onChange]);
 return null;
}
