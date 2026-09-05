const DARE_API_URL = "https://dare-backend-vx8w.onrender.com";

let currentUserCache = undefined;
let currentStreamerCache = undefined;


// ============================================================
// API FETCH
// ============================================================

async function apiFetch(path, options = {}) {

    const config = {
        credentials: "include",
        ...options,
        headers: {
            ...(options.headers || {})
        }
    };

    // Use saved session token as Authorization header
    const token = localStorage.getItem("token");

    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Automatically convert objects to JSON
    if (config.body && typeof config.body !== "string") {

        config.headers["Content-Type"] =
            "application/json";

        config.body =
            JSON.stringify(config.body);
    }

    const response = await fetch(
        DARE_API_URL + path,
        config
    );

    let data = null;

    try {
        data = await response.json();
    } catch (_) {
        data = null;
    }

    if (!response.ok) {

        const message =
            data?.error?.message ||
            data?.error ||
            `Request failed (${response.status})`;

        const error = new Error(message);

        error.status = response.status;
        error.code = data?.error?.code;

        throw error;
    }

    return data;
}


// ============================================================
// REGISTER
// ============================================================

async function register(
    username,
    email,
    password
) {

    const result = await apiFetch(
        "/api/auth/register",
        {
            method: "POST",

            body: {
                username,
                email,
                password
            }
        }
    );

    if (result?.data?.user) {

        currentUserCache =
            result.data.user;

        localStorage.setItem(
            "user",
            JSON.stringify(result.data.user)
        );
    }

    if (result?.data?.sessionToken) {

        localStorage.setItem(
            "token",
            result.data.sessionToken
        );
    }

    // New account means streamer profile
    // may now exist on the backend.
    currentStreamerCache = undefined;

    return result;
}


// ============================================================
// LOGIN
// ============================================================

async function login(
    email,
    password
) {

    const result = await apiFetch(
        "/api/auth/login",
        {
            method: "POST",

            body: {
                email,
                password
            }
        }
    );

    if (result?.data?.user) {

        currentUserCache =
            result.data.user;

        localStorage.setItem(
            "user",
            JSON.stringify(result.data.user)
        );
    }

    // Save session token
    if (result?.data?.sessionToken) {

        localStorage.setItem(
            "token",
            result.data.sessionToken
        );
    }

    // Refresh streamer profile
    currentStreamerCache = undefined;

    return result;
}


// ============================================================
// LOGOUT
// ============================================================

async function logout(
    redirect = true
) {

    try {

        await apiFetch(
            "/api/auth/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );
    }

    currentUserCache = null;
    currentStreamerCache = null;

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("streamer");

    if (redirect) {

        window.location.href =
            "login.html";
    }
}


// ============================================================
// GET CURRENT USER FROM SERVER
// ============================================================

async function getCurrentUserAsync() {

    if (currentUserCache !== undefined) {
        return currentUserCache;
    }

    try {

        const result =
            await apiFetch(
                "/api/auth/me"
            );

        currentUserCache =
            result?.data?.user || null;

        if (currentUserCache) {

            localStorage.setItem(
                "user",
                JSON.stringify(currentUserCache)
            );
        }

        return currentUserCache;

    } catch (error) {

        if (error.status === 401) {

            currentUserCache = null;

            currentStreamerCache = null;

            localStorage.removeItem("user");
            localStorage.removeItem("token");
            localStorage.removeItem("streamer");

            return null;
        }

        throw error;
    }
}


// ============================================================
// GET CURRENT USER FROM LOCAL STORAGE
// ============================================================

function getCurrentUser() {

    const cached =
        localStorage.getItem("user");

    if (!cached) {
        return null;
    }

    try {

        return JSON.parse(cached);

    } catch (_) {

        return null;
    }
}


// ============================================================
// GET CURRENT USER ID
// ============================================================

function getCurrentUserId() {

    const user =
        getCurrentUser();

    return user?.id || null;
}


// ============================================================
// GET USERNAME
// ============================================================

function getCurrentUsername() {

    const user =
        getCurrentUser();

    return user?.username || null;
}


// ============================================================
// LOGIN CHECK
// ============================================================

async function isLoggedInAsync() {

    const user =
        await getCurrentUserAsync();

    return !!user;
}


function isLoggedIn() {

    return !!getCurrentUser();
}


// ============================================================
// REQUIRE LOGIN
// ============================================================

async function requireLogin() {

    try {

        const user =
            await getCurrentUserAsync();

        if (!user) {

            window.location.href =
                "login.html";

            return null;
        }

        return user;

    } catch (error) {

        console.error(
            "Authentication check failed:",
            error
        );

        window.location.href =
            "login.html";

        return null;
    }
}


// ============================================================
// AUTHENTICATED FETCH
// ============================================================

async function authenticatedFetch(
    path,
    options = {}
) {

    try {

        const user =
            await getCurrentUserAsync();

        if (!user) {

            window.location.href =
                "login.html";

            return null;
        }

        return await apiFetch(
            path,
            options
        );

    } catch (error) {

        if (error.status === 401) {

            currentUserCache = null;
            currentStreamerCache = null;

            localStorage.removeItem("user");
            localStorage.removeItem("token");
            localStorage.removeItem("streamer");

            window.location.href =
                "login.html";

            return null;
        }

        throw error;
    }
}


// ============================================================
// AUTHENTICATED JSON
// ============================================================

async function authenticatedJson(
    path,
    options = {}
) {

    return await authenticatedFetch(
        path,
        options
    );
}


// ============================================================
// GET MY STREAMER PROFILE
// ============================================================
//
// This is the important new part.
//
// The streamer is NOT identified by Twitch username anymore.
//
// Instead:
//
// Nerve Account
//      ↓
// User ID
//      ↓
// Streamer Profile ID
//
// ============================================================

async function getMyStreamerAsync(
    forceRefresh = false
) {

    if (
        !forceRefresh &&
        currentStreamerCache !== undefined
    ) {
        return currentStreamerCache;
    }

    try {

        const result =
            await authenticatedFetch(
                "/api/my-streamers"
            );

        if (!result) {
            return null;
        }

        const streamers =
            result?.data?.streamers ||
            result?.streamers ||
            [];

        // Our new system gives each Nerve account
        // its own streamer profile.

        const streamer =
            streamers.length > 0
                ? streamers[0]
                : null;

        currentStreamerCache =
            streamer;

        if (streamer) {

            localStorage.setItem(
                "streamer",
                JSON.stringify(streamer)
            );

        } else {

            localStorage.removeItem(
                "streamer"
            );
        }

        return streamer;

    } catch (error) {

        console.error(
            "Failed to load streamer profile:",
            error
        );

        throw error;
    }
}


// ============================================================
// GET MY STREAMER PROFILE
// ============================================================

function getMyStreamer() {

    if (currentStreamerCache) {
        return currentStreamerCache;
    }

    const cached =
        localStorage.getItem("streamer");

    if (!cached) {
        return null;
    }

    try {

        return JSON.parse(cached);

    } catch (_) {

        return null;
    }
}


// ============================================================
// GET MY STREAMER ID
// ============================================================

function getMyStreamerId() {

    const streamer =
        getMyStreamer();

    return streamer?.id || null;
}


// ============================================================
// GET STREAMER ID AS STRING
// ============================================================
//
// Useful for WebSocket / URL parameters.
//

function getMyStreamerIdString() {

    const id =
        getMyStreamerId();

    return id !== null &&
           id !== undefined
        ? String(id)
        : null;
}


// ============================================================
// REFRESH STREAMER PROFILE
// ============================================================

async function refreshMyStreamer() {

    currentStreamerCache =
        undefined;

    localStorage.removeItem(
        "streamer"
    );

    return await getMyStreamerAsync(
        true
    );
}


// ============================================================
// UPDATE MY STREAMER PROFILE
// ============================================================
//
// This works with the backend endpoint:
//
// PATCH /api/my-streamer
//
// The controller/settings page can use this later
// for Twitch / YouTube / Kick information.
//

async function updateMyStreamer(
    updates = {}
) {

    const result =
        await authenticatedFetch(
            "/api/my-streamer",
            {
                method: "PATCH",
                body: updates
            }
        );

    if (!result) {
        return null;
    }

    const streamer =
        result?.data?.streamer ||
        result?.streamer ||
        null;

    if (streamer) {

        currentStreamerCache =
            streamer;

        localStorage.setItem(
            "streamer",
            JSON.stringify(streamer)
        );
    }

    return result;
}


// ============================================================
// WEBSOCKET TOKEN
// ============================================================
//
// Browser WebSockets cannot send an Authorization header
// during the initial connection.
//
// The controller will instead connect first and then send:
//
// {
//     type: "AUTH",
//     token: "...",
//     role: "controller"
// }
//
// ============================================================

function getAuthToken() {

    return localStorage.getItem(
        "token"
    );
}


// ============================================================
// WEBSOCKET AUTH MESSAGE
// ============================================================

function createWebSocketAuthMessage(
    role = "controller"
) {

    return {
        type: "AUTH",

        token:
            getAuthToken(),

        role
    };
}


// ============================================================
// AUTH CACHE CLEAR
// ============================================================

function clearAuthCache() {

    currentUserCache =
        undefined;

    currentStreamerCache =
        undefined;

    localStorage.removeItem(
        "user"
    );

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "streamer"
    );
}
