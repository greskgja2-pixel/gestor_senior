'use client';

import {useEffect} from 'react';

export default function SuperAnaliseBodyMode(){
  useEffect(()=>{
    document.body.classList.add('super-analise-page');
    return()=>document.body.classList.remove('super-analise-page');
  },[]);
  return null;
}
