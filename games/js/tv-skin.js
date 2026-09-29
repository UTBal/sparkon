const select=document.getElementById('tvSkin');
function apply(theme){
 const valid=['original','premium','hero'].includes(theme)?theme:'original';
 document.documentElement.dataset.theme=valid;
 const logo=document.querySelector('header.app img.logo');
 if(logo)logo.src='/games/assets/'+(valid==='original'?'logo-original.svg':'logo.svg');
 select.value=valid;
 sessionStorage.setItem('sparkonTVScreenSkin',valid);
}
select.addEventListener('change',()=>apply(select.value));
apply(sessionStorage.getItem('sparkonTVScreenSkin')||'premium');
