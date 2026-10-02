let products=[], cart=JSON.parse(localStorage.getItem("djrCart")||"[]"), category="All", pendingCustomer=null;

const $=s=>document.querySelector(s);
function money(n){return "₹"+Number(n).toLocaleString("en-IN",{maximumFractionDigits:0})}
function toast(t){const x=$("#toast");x.textContent=t;x.style.display="block";setTimeout(()=>x.style.display="none",2200)}
function save(){localStorage.setItem("djrCart",JSON.stringify(cart));renderCart();$("#cartCount").textContent=cart.reduce((a,b)=>a+b.qty,0)}
async function load(){products=await fetch("/api/products").then(r=>r.json());renderProducts()}
function renderProducts(){
  const q=($("#search").value||"").toLowerCase();
  const list=products.filter(p=>(category==="All"||p.category===category)&&(`${p.name} ${p.category}`.toLowerCase().includes(q)));
  $("#resultCount").textContent=`${list.length} products`;
  $("#productGrid").innerHTML=list.map(p=>`
    <article class="card">
      <div class="pic">${p.image?`<img src="${p.image}" alt="">`:`<div class="placeholder">⚽</div>`}</div>
      <div class="card-body">
        <span class="tag">${p.category}</span><h3>${p.name}</h3>
        <div><span class="price">${money(p.price)}</span>${p.mrp>p.price?`<span class="mrp">${money(p.mrp)}</span><span class="discount">${p.discount}% off</span>`:""}</div>
        <div class="stock">${p.stock>0?`${p.stock} available`:"Out of stock"}</div>
        <div class="card-actions"><button class="details" onclick="openProduct(${p.id})">View</button><button class="buy" ${p.stock<1?"disabled":""} onclick="quickAdd(${p.id})">Add to cart</button></div>
      </div>
    </article>`).join("")||`<p class="muted">No products found.</p>`;
}
function searchProducts(){renderProducts()}
function setCategory(c,el){category=c;document.querySelectorAll(".cat").forEach(x=>x.classList.remove("active"));el.classList.add("active");renderProducts()}
function quickAdd(id){const p=products.find(x=>x.id===id);if(!p||p.stock<1)return;let item=cart.find(x=>x.id===id&&x.size==="");if(item)item.qty=Math.min(item.qty+1,p.stock);else cart.push({id,qty:1,size:""});save();toast("Added to cart")}
function openProduct(id){
  const p=products.find(x=>x.id===id);
  $("#productDetail").innerHTML=`<div class="detail-grid"><div class="detail-image">${p.image?`<img src="${p.image}">`:`<div class="placeholder">⚽</div>`}</div><div><span class="tag">${p.category}</span><h2>${p.name}</h2><p class="muted">${p.description||"Football gear built for players."}</p><div class="price">${money(p.price)} ${p.mrp>p.price?`<span class="mrp">${money(p.mrp)}</span>`:""}</div><p>Choose size:</p><div class="size-list">${(p.sizes.length?p.sizes:["Standard"]).map((s,i)=>`<button class="size ${i===0?"selected":""}" onclick="this.parentElement.querySelectorAll('.size').forEach(x=>x.classList.remove('selected'));this.classList.add('selected')">${s}</button>`).join("")}</div><button class="primary full" onclick="addFromDetail(${p.id})">Add to cart</button></div></div>`;
  $("#productModal").classList.remove("hidden");
}
function addFromDetail(id){const p=products.find(x=>x.id===id);const size=document.querySelector("#productDetail .size.selected")?.textContent||"";let item=cart.find(x=>x.id===id&&x.size===size);if(item)item.qty=Math.min(item.qty+1,p.stock);else cart.push({id,qty:1,size});save();closeModal("productModal");toast("Added to cart")}
function openCart(){renderCart();$("#cartModal").classList.remove("hidden")}
function renderCart(){
  if(!$("#cartItems"))return;
  let total=0;
  $("#cartItems").innerHTML=cart.length?cart.map((x,i)=>{const p=products.find(y=>y.id===x.id);if(!p)return"";total+=p.price*x.qty;return `<div class="cart-row"><div class="cart-thumb">${p.image?`<img src="${p.image}">`:"⚽"}</div><div><b>${p.name}</b><div class="muted">${x.size?"Size: "+x.size:"Standard"}</div><div class="qty"><button onclick="changeQty(${i},-1)">−</button>${x.qty}<button onclick="changeQty(${i},1)">+</button></div></div><strong>${money(p.price*x.qty)}</strong></div>`}).join(""):`<p class="muted">Your cart is empty.</p>`;
  $("#cartTotal").textContent=money(total);$("#cartCount").textContent=cart.reduce((a,b)=>a+b.qty,0)
}
function changeQty(i,d){const p=products.find(x=>x.id===cart[i].id);cart[i].qty+=d;if(cart[i].qty>p.stock)cart[i].qty=p.stock;if(cart[i].qty<=0)cart.splice(i,1);save()}
function closeModal(id){$("#"+id).classList.add("hidden")}
function goCheckout(){if(!cart.length)return toast("Your cart is empty");closeModal("cartModal");$("#checkoutModal").classList.remove("hidden")}
$("#checkoutForm").addEventListener("submit",e=>{e.preventDefault();pendingCustomer=Object.fromEntries(new FormData(e.target));closeModal("checkoutModal");const total=cart.reduce((a,x)=>a+(products.find(p=>p.id===x.id)?.price||0)*x.qty,0);$("#payAmount").textContent=money(total);$("#paymentModal").classList.remove("hidden")});
$("#paymentForm").addEventListener("submit",async e=>{e.preventDefault();const utr=$("#utr").value.trim();if(!utr)return;const res=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer:pendingCustomer,utr,items:cart})});const data=await res.json();if(!res.ok)return toast(data.error||"Could not place order");cart=[];save();closeModal("paymentModal");$("#orderNumber").textContent=data.orderNo;$("#trackLink").href="/track.html?order="+encodeURIComponent(data.orderNo);$("#successModal").classList.remove("hidden")});
$("#search").addEventListener("input",renderProducts);load();
