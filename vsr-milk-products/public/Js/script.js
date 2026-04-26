const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '5000' ? 'http://localhost:5000' : window.location.origin;

// --- Cart System (LocalStorage based + Backend Sync) ---
let cart = JSON.parse(localStorage.getItem('vsr_cart')) || [];

function saveCart() {
    localStorage.setItem('vsr_cart', JSON.stringify(cart));
}

async function addToCart(name, price, image, qty, id) {
    qty = qty || 1;
    const existing = cart.find(item => item.name === name);
    if (existing) {
        existing.quantity += qty;
    } else {
        cart.push({ id, name, price: parseFloat(price), image, quantity: qty });
    }
    saveCart();
    updateCartCount();
    showToast(`${name} added to cart!`, 'success');

    // Sync with backend if logged in
    const user = JSON.parse(localStorage.getItem('vsr_user'));
    if (user && (user.id || user.uid) && id) {
        try {
            await fetch(`${API_BASE_URL}/cart/add`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('vsr_token')}`
                },
                body: JSON.stringify({
                    user_id: user.id || user.uid,
                    product_id: id,
                    quantity: qty
                })
            });
        } catch (err) {
            console.error('Backend cart sync failed:', err);
        }
    }
}

async function removeFromCart(name) {
    const item = cart.find(i => i.name === name);
    const id = item ? item.id : null;
    cart = cart.filter(i => i.name !== name);
    saveCart();
    updateCartCount();

    // Sync with backend
    const user = JSON.parse(localStorage.getItem('vsr_user'));
    if (user && (user.id || user.uid) && id) {
        try {
            // Backend removeFromCart usually needs a cart row ID or user_id + product_id
            // Our backend delete is /remove/:id where id is cart_id
            // But we don't always have cart_id locally. 
            // We can add a more general remove endpoint or use user_id + product_id
            // For now, let's assume we need to find the cart_id by fetching cart first or 
            // update backend to allow delete by user_id/product_id
            
            // Actually, let's just clear and re-sync or modify backend. 
            // Let's modify backend cart.js to allow remove by user_id & product_id.
            await fetch(`${API_BASE_URL}/cart/remove-item`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('vsr_token')}`
                },
                body: JSON.stringify({ user_id: user.id || user.uid, product_id: id })
            });
        } catch (err) {
            console.error('Backend remove error:', err);
        }
    }
}

async function changeCartQty(name, change) {
    const item = cart.find(i => i.name === name);
    if (item) {
        const id = item.id;
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(name);
            return;
        }
        saveCart();
        updateCartCount();

        // Sync with backend
        const user = JSON.parse(localStorage.getItem('vsr_user'));
        if (user && (user.id || user.uid) && id) {
            try {
                await fetch(`${API_BASE_URL}/cart/update-qty`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('vsr_token')}`
                    },
                    body: JSON.stringify({
                        user_id: user.id || user.uid,
                        product_id: id,
                        quantity: item.quantity
                    })
                });
            } catch (err) {
                console.error('Backend qty update error:', err);
            }
        }
    }
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function updateCartCount() {
    const countEls = document.querySelectorAll('#cart-count, .cart-count');
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    countEls.forEach(el => { el.innerText = total; });
}

// --- Mobile Menu Toggle ---
function toggleMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// --- Toast Notification ---
function showToast(message, type = '') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// --- Wishlist System ---
let wishlist = JSON.parse(localStorage.getItem('vsr_wishlist')) || [];

function saveWishlist() {
    localStorage.setItem('vsr_wishlist', JSON.stringify(wishlist));
}

async function toggleWishlist(name, price, image, id) {
    const index = wishlist.findIndex(item => item.name === name);
    const user = JSON.parse(localStorage.getItem('vsr_user'));

    if (index > -1) {
        wishlist.splice(index, 1);
        showToast('Removed from wishlist', '');
        
        // Sync Remove
        if (user && (user.id || user.uid) && id) {
            try {
                await fetch(`${API_BASE_URL}/wishlist/remove`, {
                    method: 'DELETE',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('vsr_token')}`
                    },
                    body: JSON.stringify({ user_id: user.id || user.uid, product_id: id })
                });
            } catch (err) { console.error('Wishlist remove error:', err); }
        }
    } else {
        wishlist.push({ id, name, price: parseFloat(price), image, addedAt: new Date().toISOString() });
        showToast('Added to wishlist ❤️', 'success');

        // Sync Add
        if (user && (user.id || user.uid) && id) {
            try {
                await fetch(`${API_BASE_URL}/wishlist/add`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('vsr_token')}`
                    },
                    body: JSON.stringify({ user_id: user.id || user.uid, product_id: id })
                });
            } catch (err) { console.error('Wishlist add error:', err); }
        }
    }
    saveWishlist();
    updateWishlistUI();
}

function isInWishlist(name) {
    return wishlist.some(item => item.name === name);
}

function moveToCartFromWishlist(name) {
    const item = wishlist.find(i => i.name === name);
    if (item) {
        addToCart(item.name, item.price, item.image, 1);
        wishlist = wishlist.filter(i => i.name !== name);
        saveWishlist();
        updateWishlistUI();
    }
}

async function removeFromWishlist(name) {
    const item = wishlist.find(i => i.name === name);
    const id = item ? item.id : null;
    wishlist = wishlist.filter(i => i.name !== name);
    saveWishlist();
    updateWishlistUI();
    showToast('Removed from wishlist', '');

    const user = JSON.parse(localStorage.getItem('vsr_user'));
    if (user && (user.id || user.uid) && id) {
        try {
            await fetch(`${API_BASE_URL}/wishlist/remove`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('vsr_token')}`
                },
                body: JSON.stringify({ user_id: user.id || user.uid, product_id: id })
            });
        } catch (err) { console.error('Wishlist remove error:', err); }
    }
}

async function syncWishlistWithBackend() {
    const user = JSON.parse(localStorage.getItem('vsr_user'));
    if (!user || (!user.id && !user.uid)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/wishlist/${user.id || user.uid}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('vsr_token')}` }
        });
        if (response.ok) {
            const backendWish = await response.json();
            if (backendWish.length > 0) {
                wishlist = backendWish.map(item => ({
                    id: item.product_id || item.id,
                    name: item.name,
                    price: item.price,
                    image: item.image_url,
                    addedAt: new Date().toISOString()
                }));
                saveWishlist();
                updateWishlistUI();
                if (typeof renderWishlistPage === 'function') renderWishlistPage();
            }
        }
    } catch (err) {
        console.error('Sync wishlist error:', err);
    }
}

async function syncCartWithBackend() {
    const user = JSON.parse(localStorage.getItem('vsr_user'));
    if (!user || (!user.id && !user.uid)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/cart/${user.id || user.uid}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('vsr_token')}` }
        });
        if (response.ok) {
            const backendCart = await response.json();
            // Merge or replace? For simplicity, we'll merge logic or just use backend
            // Let's replace local with backend for consistency if user is logged in
            if (backendCart.length > 0) {
                cart = backendCart.map(item => ({
                    id: item.product_id || item.id, // backend response might vary
                    name: item.name,
                    price: item.price,
                    image: item.image_url,
                    quantity: item.quantity
                }));
                saveCart();
                updateCartCount();
                if (typeof renderCart === 'function') renderCart();
            }
        }
    } catch (err) {
        console.error('Sync cart error:', err);
    }
}

function updateWishlistUI() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        const name = btn.dataset.name;
        if (isInWishlist(name)) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="far fa-heart"></i>';
        }
    });
}

// --- Order Summary (Payment Page) ---
function renderOrderSummary() {
    const summaryDiv = document.getElementById('order-summary');
    const totalEl = document.getElementById('order-total');
    if (!summaryDiv) return;

    cart = JSON.parse(localStorage.getItem('vsr_cart')) || [];
    summaryDiv.innerHTML = '';

    if (cart.length === 0) {
        summaryDiv.innerHTML = '<p style="color: #999; text-align: center; padding: 30px 20px;">Your cart is empty. <a href="products.html" style="color: #27ae60; font-weight: 500;">Shop Now →</a></p>';
        if (totalEl) {
            const span = totalEl.querySelector('span');
            if (span) span.innerText = '₹0';
        }
        return;
    }

    let total = 0;
    cart.forEach(item => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQty = parseInt(item.quantity) || 1;
        const itemTotal = itemPrice * itemQty;
        total += itemTotal;

        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid #f0f0f0;';

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px;">
                <img src="${item.image || 'images/default_product.png'}" alt="${item.name || 'Product'}" style="width:48px; height:48px; object-fit:contain; background:#f9f9f9; border-radius:8px; padding:4px;">
                <div>
                    <div style="font-weight:500; font-size:0.93rem; color:#212121;">${item.name || 'Product'}</div>
                    <div style="color:#878787; font-size:0.82rem;">₹${itemPrice} × ${itemQty}</div>
                </div>
            </div>
            <div style="font-weight:600; color:#212121; font-size:0.95rem;">₹${itemTotal}</div>
        `;
        summaryDiv.appendChild(div);
    });

    if (totalEl) {
        const span = totalEl.querySelector('span');
        if (span) span.innerText = '₹' + total;
    }
}

// --- Cancel Order ---
function cancelOrder(orderId) {
    const orders = JSON.parse(localStorage.getItem('vsr_orders')) || [];
    const order = orders.find(o => o.id == orderId);

    if (!order) { showToast('Order not found', 'error'); return; }
    if (order.status === 'Delivered' || order.status === 'Out for Delivery') {
        showToast('Cannot cancel — order is already ' + order.status, 'error');
        return;
    }

    const reason = prompt('Please enter reason for cancellation:');
    if (!reason || reason.trim() === '') { showToast('Cancellation requires a reason', 'error'); return; }

    order.status = 'Cancelled';
    order.cancelReason = reason;
    order.cancelledAt = new Date().toISOString();
    localStorage.setItem('vsr_orders', JSON.stringify(orders));

    const user = JSON.parse(localStorage.getItem('vsr_user')) || {};
    const item = order.items && order.items[0] ? order.items[0].name : 'N/A';
    const msg = `🚫 *Order Cancelled*\n\n` +
                `Customer: ${user.name || 'Guest'}\n` +
                `Email: ${user.email || 'N/A'}\n` +
                `Product: ${item}\n` +
                `Order ID: ${order.id}\n` +
                `Reason: ${reason}`;

    window.open(`https://wa.me/918143713538?text=${encodeURIComponent(msg)}`, '_blank');
    showToast('Order cancelled successfully', 'success');
}

// --- Invoice Generation (uses jsPDF) ---
function generateInvoice(orderId) {
    const orders = JSON.parse(localStorage.getItem('vsr_orders')) || [];
    const order = orders.find(o => o.id == orderId);
    if (!order) return;

    const user = JSON.parse(localStorage.getItem('vsr_user')) || {};

    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => _buildInvoice(order, user);
        document.head.appendChild(script);
    } else {
        _buildInvoice(order, user);
    }
}

function _buildInvoice(order, user) {
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF();

    doc.setFillColor(39, 174, 96);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text("VSRFARM'S", 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Invoice / Tax Receipt', 105, 25, { align: 'center' });

    doc.setTextColor(33, 33, 33);
    let y = 50;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 15, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(`Name: ${user.name || 'Customer'}`, 15, y);
    y += 6;
    doc.text(`Email: ${user.email || 'N/A'}`, 15, y);

    y = 50;
    doc.setFont('helvetica', 'bold');
    doc.text('Order Details:', 120, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(`Order ID: ${order.id}`, 120, y);
    y += 6;
    doc.text(`Date: ${new Date(order.date).toLocaleDateString()}`, 120, y);
    y += 6;
    doc.text(`Status: ${order.status}`, 120, y);

    y = 85;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, 195, y);

    y += 10;
    doc.setFillColor(245, 245, 245);
    doc.rect(15, y - 5, 180, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Product', 18, y + 2);
    doc.text('Qty', 120, y + 2);
    doc.text('Price', 145, y + 2);
    doc.text('Total', 175, y + 2);

    y += 12;
    doc.setFont('helvetica', 'normal');
    let grandTotal = 0;

    if (order.items) {
        order.items.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            grandTotal += itemTotal;
            doc.text(item.name || 'Product', 18, y);
            doc.text(String(item.quantity || 1), 125, y);
            doc.text(`₹${item.price || 0}`, 145, y);
            doc.text(`₹${itemTotal}`, 175, y);
            y += 8;
        });
    }

    y += 5;
    doc.line(15, y, 195, y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Grand Total: ₹${order.total || grandTotal}`, 175, y, { align: 'right' });

    y += 20;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('VSR Farm\'s — VR Nagar, Sai Baba Temple Street, Kavali 524201', 105, y, { align: 'center' });
    doc.text('Phone: +91 81437 13538', 105, y + 5, { align: 'center' });

    doc.save(`VSR_Invoice_${order.id}.pdf`);
    showToast('Invoice downloaded!', 'success');
}

// --- Reviews System ---
async function saveReview(productName, rating, comment, userName) {
    const user = JSON.parse(localStorage.getItem('vsr_user'));
    const products = JSON.parse(localStorage.getItem('vsr_products_cache')) || [];
    const product = products.find(p => p.name === productName);

    const reviewData = {
        user_id: user ? (user.id || user.uid) : null,
        product_id: product ? product.id : null,
        rating: parseInt(rating),
        comment: comment
    };

    if (!reviewData.user_id) {
        console.warn('Anonymous review or user not found');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/reviews/add`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('vsr_token')}`
            },
            body: JSON.stringify(reviewData)
        });
        
        if (response.ok) {
            // Refresh home reviews if showing
            if (document.getElementById('home-reviews-grid')) {
                renderHomeReviews();
            }
            return true;
        }
    } catch (err) {
        console.error('Save review error:', err);
    }
    return false;
}

async function renderHomeReviews() {
    const container = document.getElementById('home-reviews-grid');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/reviews`);
        if (!response.ok) throw new Error('Failed to fetch reviews');
        const reviews = await response.json();

        if (reviews.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">No reviews yet. Be the first to review!</p>';
            return;
        }

        container.innerHTML = reviews.map(r => {
            const rating = parseInt(r.rating) || 5;
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
            const date = new Date(r.date).toLocaleDateString();
            return `
            <div class="review-card fade-in">
                <span class="quote-icon">"</span>
                <div class="reviewer-header">
                    <div class="reviewer-avatar"><i class="fas fa-user"></i></div>
                    <div class="reviewer-info">
                        <h4>${r.user || 'Valued Customer'}</h4>
                        <div class="review-stars" style="color:#f1c40f;">${stars}</div>
                    </div>
                </div>
                <p class="review-text">"${r.comment}"</p>
                <p style="font-size: 0.78rem; color: #aaa; margin-top: 10px;">${date} — ${r.product || 'Fresh Product'}</p>
            </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Reviews load error:', err);
    }
}

// =========================================================
//  PROFILE FLIP AVATAR — 3D Flip with Owner/Customer sides
// =========================================================

/**
 * initProfileFlip()
 * Immediately populates the avatar front/back content using localStorage state.
 * NO async Firebase dependency — works instantly on page load.
 */
function initProfileFlip() {
    const container = document.querySelector('.profile-flip-container');
    const front = document.querySelector('.profile-front');
    const back = document.querySelector('.profile-back');
    const logoutBtn = document.getElementById('headerLogout') || document.querySelector('.header-logout-btn');

    if (!container || !front || !back) return;

    const isOwner = localStorage.getItem('vsr_owner_active') === 'true';
    const userData = JSON.parse(localStorage.getItem('vsr_user') || 'null');
    const isLoggedIn = isOwner || (userData && userData.email);

    // Clean up classes
    container.classList.remove('logged-in');

    if (isLoggedIn) {
        container.classList.add('logged-in');
        
        const name = isOwner ? 'ADMIN' : (userData.displayName || userData.email || 'U').charAt(0).toUpperCase();
        const icon = isOwner ? 'fa-user-shield' : 'fa-user-check';
        const color = isOwner ? '#d4af37' : '#27ae60';

        const html = `
            <div style="background:${color}; color:white; width:42px; height:42px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.2); border: 2px solid white;">
                <i class="fas ${icon}" style="font-size:1rem;"></i>
                <span style="font-size:0.6rem; font-weight:bold; line-height:1;">${isOwner ? 'ADMIN' : name}</span>
            </div>
        `;

        front.innerHTML = html;
        back.innerHTML = html; // Same on both sides when logged in
        front.onclick = () => window.location.href = isOwner ? 'owner_dashboard.html' : 'customer.html';
        
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';

    } else {
        // NOT LOGGED IN - Show Flip between Owner and Customer Login
        front.innerHTML = `
            <div style="background:#fff; color:#d4af37; width:40px; height:40px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px solid #d4af37;">
                <i class="fas fa-user-tie"></i>
                <span style="font-size:0.5rem; font-weight:bold;">OWNER</span>
            </div>
        `;
        front.onclick = () => window.location.href = 'owner_login.html';

        back.innerHTML = `
            <div style="background:#27ae60; color:#fff; width:40px; height:40px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; border: 2px solid white;">
                <i class="fas fa-user"></i>
                <span style="font-size:0.5rem; font-weight:bold;">LOGIN</span>
            </div>
        `;
        back.onclick = () => window.location.href = 'login.html';

        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

// =========================================================
//  AUTH UI — Lightweight, no dynamic import needed
// =========================================================

function updateAuthUI() {
    // Just call initProfileFlip — it handles everything from localStorage
    initProfileFlip();
}

// OWNER LOGIN HANDLER
window.handleOwnerLoginPrompt = function() {
    window.location.href = 'owner_login.html';
};

// LOGOUT HANDLER
window.handleGlobalLogout = function() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear all session markers immediately
        localStorage.removeItem('vsr_token');
        localStorage.removeItem('vsr_user');
        localStorage.removeItem('vsr_owner_active');
        localStorage.removeItem('user_role');

        // Try Firebase logout and refresh
        try {
            import('/Js/auth.js?v=1.1').then(authMod => {
                authMod.logout().then(() => {
                    window.location.href = '/index.html';
                });
            }).catch(() => {
                window.location.href = '/index.html';
            });
        } catch(e) {
            window.location.href = '/index.html';
        }
    }
};

// --- Cross-Tab Synchronization ---
window.addEventListener('storage', (e) => {
    if (e.key === 'vsr_cart' || e.key === 'vsr_user' || e.key === 'vsr_owner_active' || e.key === 'vsr_wishlist') {
        // Refresh local variables
        if (e.key === 'vsr_cart') cart = JSON.parse(e.newValue || '[]');
        if (e.key === 'vsr_wishlist') wishlist = JSON.parse(e.newValue || '[]');
        
        // Update UI
        updateCartCount();
        updateWishlistUI();
        initProfileFlip();
        
        // Page specific updates
        if (document.getElementById('order-summary')) renderOrderSummary();
        if (document.getElementById('home-reviews-grid')) renderHomeReviews();
    }
});

// =========================================================
//  SINGLE DOMContentLoaded — Initialize everything
// =========================================================
document.addEventListener('DOMContentLoaded', function () {
    // Refresh data from storage
    cart = JSON.parse(localStorage.getItem('vsr_cart')) || [];
    wishlist = JSON.parse(localStorage.getItem('vsr_wishlist')) || [];
    updateCartCount();
    updateWishlistUI();

    // Initialize Profile Flip Avatar
    initProfileFlip();

    // Sync cart and wishlist from backend if logged in
    syncCartWithBackend();
    syncWishlistWithBackend();

    // If on payment page, render order summary
    if (document.getElementById('order-summary')) {
        renderOrderSummary();
    }

    // If on home page, render reviews
    if (document.getElementById('home-reviews-grid')) {
        renderHomeReviews();
    }

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) navLinks.classList.remove('active');
        });
    });
});



