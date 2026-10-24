const form=document.querySelector('#reading-form');
form?.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button'),status=document.querySelector('#reading-status');button.disabled=true;
  try{const data=Object.fromEntries(new FormData(form));data.acknowledged=form.elements.acknowledged.checked;
    const response=await fetch(location.pathname+'/reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await response.json();if(!response.ok)throw new Error(result.error);status.textContent=result.message;
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
});
