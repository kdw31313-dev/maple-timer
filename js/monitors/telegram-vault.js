// Only the encrypted vault is published. The key arrives in a private URL fragment.
export async function unlockTelegram(){
 const hash=new URLSearchParams(location.hash.slice(1));const encoded=hash.get('telegram-key');if(!encoded)return;
 const status=document.getElementById('telegram-status-pill');
 try {
  if(!/^[A-Za-z0-9_-]{43}$/.test(encoded))throw Error('invalid key');
  const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const response=await fetch(new URL('./telegram-vault.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('vault missing');
  const vault=await response.json();if(vault.version!==1)throw Error('unsupported vault');
  const key=await crypto.subtle.importKey('raw',decode(encoded),{name:'AES-GCM'},false,['decrypt']);
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(vault.iv)},key,decode(vault.ciphertext));
  const config=JSON.parse(new TextDecoder().decode(bytes));
  if(!/^\d+:[\w-]+$/.test(config.botToken)||!/^-[0-9]+$/.test(config.chatId))throw Error('invalid configuration');
  if(!window.telegramNotifier.saveConfig(config))throw Error('storage unavailable');
  for(const [id,value] of [['telegram-bot-token',config.botToken],['telegram-chat-id',config.chatId],['telegram-thread-id',config.threadId]])document.getElementById(id).value=value;
  document.getElementById('toggle-telegram-alert').checked=true;
  if(status){status.textContent='개인 링크 설정 완료 · 테스트로 수신 확인';status.className='status-pill active';}
  // Remove the secret from the address bar after saving; the original .url is reusable.
  history.replaceState(null,'',location.pathname+location.search);
 }catch{if(status)status.textContent='개인 링크를 열지 못했습니다. 원본 링크와 브라우저 저장 허용을 확인하세요.';}
}
