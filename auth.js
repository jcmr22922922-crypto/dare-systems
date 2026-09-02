// ================================
// DARE SYSTEM - AUTHENTICATION
// ================================

const API_URL = "https://dare-backend-vx8w.onrender.com";

// -------------------------------
// REGISTER
// -------------------------------
async function register(username, email, password) {
    try {
        const response = await fetch(`${API_URL}/api/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Registration failed.");
        }

        return data;

    } catch (error) {
        console.error("Register error:", error);
        throw error;
    }
}


// -------------------------------
// LOGIN
// -------------------------------
async function login(email, password) {
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Login failed.");
        }

        // Save login information
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        return data;

    } catch (error) {
        console.error("Login error:", error);
        throw error;
    }
}


// -------------------------------
// LOGOUT
// -------------------------------
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "login.html";
}


// -------------------------------
// GET CURRENT USER
// -------------------------------
function getCurrentUser() {
    const user = localStorage.getItem("user");

    if (!user) {
        return null;
    }

    try {
        return JSON.parse(user);
    } catch {
        return null;
    }
}


// -------------------------------
// GET TOKEN
// -------------------------------
function getToken() {
    return localStorage.getItem("token");
}


// -------------------------------
// CHECK IF LOGGED IN
// -------------------------------
function isLoggedIn() {
    return !!getToken();
}


// -------------------------------
// PROTECT PAGE
// -------------------------------
function requireLogin() {
    if (!isLoggedIn()) {
        window.location.href = "login.html";
    }
}


// -------------------------------
// AUTHENTICATED REQUEST
// -------------------------------
async function authenticatedFetch(url, options = {}) {

    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    options.headers = {
        ...(options.headers || {}),
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    const response = await fetch(url, options);

    // Token expired / invalid
    if (response.status === 401) {
        logout();
        return;
    }

    return response;
}
