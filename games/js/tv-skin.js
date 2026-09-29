const select=document.getElementById('tvSkin');
select?.addEventListener('change',()=>window.SparkONSkin?.set(select.value));
if(select)select.value=window.SparkONSkin?.get()||'premium';
