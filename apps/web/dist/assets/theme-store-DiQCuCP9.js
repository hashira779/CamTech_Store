import{c,l as m}from"./index-5OkvZD01.js";/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]],l=c("moon",r);/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]],y=c("sun",i),k=m(d=>{const o=typeof window<"u"&&localStorage.getItem("mystore-theme")||"dark",a=(t,s=!1)=>{if(typeof window>"u")return;const e=document.documentElement;if(s&&e.classList.add("theme-transition"),e.classList.remove("light","dark"),t==="system"){const n=window.matchMedia("(prefers-color-scheme: dark)").matches;e.classList.add(n?"dark":"light")}else e.classList.add(t);localStorage.setItem("mystore-theme",t),s&&window.setTimeout(()=>{e.classList.remove("theme-transition")},350)};return typeof window<"u"&&(a(o),window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",s=>{if(localStorage.getItem("mystore-theme")==="system"){const e=document.documentElement;e.classList.remove("light","dark"),e.classList.add(s.matches?"dark":"light")}})),{theme:o,setTheme:t=>{a(t,!0),d({theme:t})}}});export{l as M,y as S,k as u};
