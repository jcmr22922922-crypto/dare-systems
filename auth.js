/* =========================================================
   NERVE AUTHENTICATION SYSTEM
   Single source of truth for:
   - Login
   - Register
   - Logout
   - Current user
   - Current streamer
   - Protected pages
   - Authenticated API requests
   - WebSocket authentication
========================================================= */

const DARE_API_URL =
    "https://dare-backend-vx8w.onrender.com";


/* =========================================================
   INTERNAL CACHE
========================================================= */

let currentUserCache = undefined;
let currentStreamerCache = undefined;


/* =========================================================
   API FETCH
========================================================= */

async function apiFetch(path, options = {}) {

    const config = {
        credentials: "include",
        ...options,

        headers: {
            ...(options.headers || {})
        }
    };


    /* -----------------------------------------
       AUTH TOKEN
    ----------------------------------------- */

    const token =
        localStorage.getItem("token");

    if (
        token &&
        !config.headers.Authorization
    ) {
        config.headers.Authorization =
            `Bearer ${token}`;
    }


    /* -----------------------------------------
       JSON BODY
    ----------------------------------------- */

    if (
        config.body &&
        typeof config.body !== "string"
    ) {
        config.headers["Content-Type"] =
            "application/json";

        config.body =
            JSON.stringify(config.body);
    }


    /* -----------------------------------------
       REQUEST
    ----------------------------------------- */

    const response =
        await fetch(
            DARE_API_URL + path,
            config
        );


    /* -----------------------------------------
       RESPONSE
    ----------------------------------------- */

    let data = null;

    try {
        data =
            await response.json();
    } catch (_) {
        data = null;
    }


    /* -----------------------------------------
       ERROR
    ----------------------------------------- */

    if (!response.ok) {

        const message =
            data?.error?.message ||
            data?.error ||
            `Request failed (${response.status})`;

        const error =
            new Error(message);

        error.status =
            response.status;

        error.code =
            data?.error?.code;

        error.data =
            data;

        throw error;
    }


    return data;
}


/* =========================================================
   REGISTER
========================================================= */

async function register(
    username,
    email,
    password
) {

    const result =
        await apiFetch(
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


    /* -----------------------------------------
       SAVE USER
    ----------------------------------------- */

    if (
        result?.data?.user
    ) {

        currentUserCache =
            result.data.user;

        localStorage.setItem(
            "user",
            JSON.stringify(
                result.data.user
            )
        );
    }


    /* -----------------------------------------
       SAVE TOKEN
    ----------------------------------------- */

    if (
        result?.data?.sessionToken
    ) {

        localStorage.setItem(
            "token",
            result.data.sessionToken
        );
    }


    /* -----------------------------------------
       RESET STREAMER CACHE
    ----------------------------------------- */

    currentStreamerCache =
        undefined;

    localStorage.removeItem(
        "streamer"
    );


    return result;
}


/* =========================================================
   LOGIN
========================================================= */

async function login(
    email,
    password
) {

    const result =
        await apiFetch(
            "/api/auth/login",
            {
                method: "POST",

                body: {
                    email,
                    password
                }
            }
        );


    /* -----------------------------------------
       SAVE USER
    ----------------------------------------- */

    if (
        result?.data?.user
    ) {

        currentUserCache =
            result.data.user;

        localStorage.setItem(
            "user",
            JSON.stringify(
                result.data.user
            )
        );
    }


    /* -----------------------------------------
       SAVE TOKEN
    ----------------------------------------- */

    if (
        result?.data?.sessionToken
    ) {

        localStorage.setItem(
            "token",
            result.data.sessionToken
        );
    }


    /* -----------------------------------------
       RESET STREAMER CACHE
    ----------------------------------------- */

    currentStreamerCache =
        undefined;

    localStorage.removeItem(
        "streamer"
    );


    return result;
}


/* =========================================================
   LOGOUT
========================================================= */

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

        /*
         Logout should still clear
         the local session even if
         the backend is temporarily
         unavailable.
        */

        console.warn(
            "Logout request failed:",
            error
        );
    }


    /* -----------------------------------------
       CLEAR MEMORY
    ----------------------------------------- */

    currentUserCache =
        null;

    currentStreamerCache =
        null;


    /* -----------------------------------------
       CLEAR LOCAL SESSION
    ----------------------------------------- */

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );

    localStorage.removeItem(
        "streamer"
    );


    /* -----------------------------------------
       RETURN HOME AFTER LOGOUT
    ----------------------------------------- */

    if (redirect) {

        window.location.href =
            "index.html";
    }
}


/* =========================================================
   GET CURRENT USER
   SERVER-AUTHORITATIVE VERSION
========================================================= */

async function getCurrentUserAsync(
    forceRefresh = false
) {

    if (
        !forceRefresh &&
        currentUserCache !== undefined
    ) {
        return currentUserCache;
    }


    /*
       If there is no local token,
       don't waste a request.
    */

    const token =
        localStorage.getItem("token");

    if (!token) {

        currentUserCache =
            null;

        return null;
    }


    try {

        const result =
            await apiFetch(
                "/api/auth/me"
            );


        const user =
            result?.data?.user ||
            null;


        currentUserCache =
            user;


        if (user) {

            localStorage.setItem(
                "user",
                JSON.stringify(user)
            );

        } else {

            localStorage.removeItem(
                "user"
            );
        }


        return user;

    } catch (error) {

        /*
           Invalid/expired authentication.
        */

        if (
            error.status === 401
        ) {

            clearAuthCache();

            return null;
        }


        /*
           Network/server problem.
           Do NOT pretend the user is logged out.
        */

        throw error;
    }
}


/* =========================================================
   GET CURRENT USER
   LOCAL/CACHED VERSION
========================================================= */

function getCurrentUser() {

    if (
        currentUserCache !== undefined
    ) {
        return currentUserCache;
    }


    const cached =
        localStorage.getItem("user");

    if (!cached) {
        return null;
    }


    try {

        return JSON.parse(
            cached
        );

    } catch (_) {

        return null;
    }
}


/* =========================================================
   USER ID
========================================================= */

function getCurrentUserId() {

    const user =
        getCurrentUser();

    if (!user) {
        return null;
    }


    return (
        user.id ??
        user.userId ??
        user.user_id ??
        null
    );
}


/* =========================================================
   USERNAME
========================================================= */

function getCurrentUsername() {

    const user =
        getCurrentUser();

    if (!user) {
        return null;
    }


    return (
        user.username ??
        user.displayName ??
        user.name ??
        null
    );
}


/* =========================================================
   IS LOGGED IN
========================================================= */

async function isLoggedInAsync() {

    const user =
        await getCurrentUserAsync();

    return !!user;
}


function isLoggedIn() {

    return !!getCurrentUser();
}


/* =========================================================
   REQUIRE LOGIN
========================================================= */

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


        /*
           Important:
           Do not automatically destroy
           a session just because the
           server is temporarily unavailable.
        */

        return null;
    }
}


/* =========================================================
   AUTHENTICATED FETCH
========================================================= */

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

        if (
            error.status === 401
        ) {

            clearAuthCache();


            window.location.href =
                "login.html";


            return null;
        }


        throw error;
    }
}


/* =========================================================
   AUTHENTICATED JSON
========================================================= */

async function authenticatedJson(
    path,
    options = {}
) {

    return await authenticatedFetch(
        path,
        options
    );
}


/* =========================================================
   STREAMER
========================================================= */

async function getMyStreamerAsync(
    forceRefresh = false
) {

    if (
        !forceRefresh &&
        currentStreamerCache !== undefined
    ) {

        return currentStreamerCache;
    }


    const user =
        await getCurrentUserAsync();


    if (!user) {

        currentStreamerCache =
            null;

        return null;
    }


    try {

        const result =
            await apiFetch(
                "/api/my-streamers"
            );


        /*
           The backend may return
           either:

           data.streamers

           or

           data directly.
        */

        const streamers =
            result?.data?.streamers ??
            result?.data ??
            result?.streamers ??
            [];


        const streamerList =
            Array.isArray(streamers)
                ? streamers
                : [];


        /*
           For now Nerve uses the
           first streamer belonging
           to the logged-in account.
        */

        const streamer =
            streamerList[0] ||
            null;


        currentStreamerCache =
            streamer;


        if (streamer) {

            localStorage.setItem(
                "streamer",
                JSON.stringify(
                    streamer
                )
            );

        } else {

            localStorage.removeItem(
                "streamer"
            );
        }


        return streamer;

    } catch (error) {

        if (
            error.status === 401
        ) {

            clearAuthCache();

            return null;
        }


        throw error;
    }
}


/* =========================================================
   GET CACHED STREAMER
========================================================= */

function getMyStreamer() {

    if (
        currentStreamerCache !== undefined
    ) {

        return currentStreamerCache;
    }


    const cached =
        localStorage.getItem(
            "streamer"
        );


    if (!cached) {
        return null;
    }


    try {

        return JSON.parse(
            cached
        );

    } catch (_) {

        return null;
    }
}


/* =========================================================
   STREAMER ID
========================================================= */

function getMyStreamerId() {

    const streamer =
        getMyStreamer();

    if (!streamer) {
        return null;
    }


    return (
        streamer.id ??
        streamer.streamerId ??
        streamer.streamer_id ??
        null
    );
}


/* =========================================================
   STREAMER ID AS STRING
========================================================= */

function getMyStreamerIdString() {

    const id =
        getMyStreamerId();

    if (
        id === null ||
        id === undefined
    ) {
        return null;
    }


    return String(id);
}


/* =========================================================
   REFRESH STREAMER
========================================================= */

async function refreshMyStreamer() {

    return await getMyStreamerAsync(
        true
    );
}


/* =========================================================
   UPDATE STREAMER
========================================================= */

async function updateMyStreamer(
    updates
) {

    const result =
        await authenticatedFetch(
            "/api/my-streamer",
            {
                method: "PATCH",
                body: updates
            }
        );


    if (
        result?.data?.streamer
    ) {

        currentStreamerCache =
            result.data.streamer;


        localStorage.setItem(
            "streamer",
            JSON.stringify(
                result.data.streamer
            )
        );
    }


    return result;
}


/* =========================================================
   AUTH TOKEN
========================================================= */

function getAuthToken() {

    return localStorage.getItem(
        "token"
    );
}


/* =========================================================
   WEBSOCKET AUTH MESSAGE
========================================================= */

function createWebSocketAuthMessage(
    role = "controller"
) {

    const token =
        getAuthToken();

    const streamerId =
        getMyStreamerIdString();


    return {

        type: "AUTH",

        token: token,

        role: role,

        streamerId: streamerId
    };
}


/* =========================================================
   CLEAR AUTH CACHE
========================================================= */

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


/* =========================================================
   AUTH NAVIGATION
========================================================= */

async function updateAuthNavigation() {

    const loginButtons =
        document.querySelectorAll(
            "[data-auth-login]"
        );


    const accountButtons =
        document.querySelectorAll(
            "[data-auth-account]"
        );


    const logoutButtons =
        document.querySelectorAll(
            "[data-auth-logout]"
        );


    try {

        const user =
            await getCurrentUserAsync();


        /* -------------------------------------
           LOGGED OUT
        ------------------------------------- */

        if (!user) {

            loginButtons.forEach(
                button => {

                    button.style.display =
                        "";

                    button.textContent =
                        button.dataset.authLoginText ||
                        "Login";

                    button.href =
                        "login.html";
                }
            );


            accountButtons.forEach(
                button => {

                    button.style.display =
                        "none";
                }
            );


            logoutButtons.forEach(
                button => {

                    button.style.display =
                        "none";
                }
            );


            return;
        }


        /* -------------------------------------
           LOGGED IN
        ------------------------------------- */

        const username =
            getCurrentUsername() ||
            "Account";


        loginButtons.forEach(
            button => {

                button.style.display =
                    "";

                button.textContent =
                    "👤 " + username;

                button.href =
                    "controller.html";
            }
        );


        accountButtons.forEach(
            button => {

                button.style.display =
                    "";

                button.textContent =
                    button.dataset.authAccountText ||
                    "👤 " + username;

                button.href =
                    "controller.html";
            }
        );


        logoutButtons.forEach(
            button => {

                button.style.display =
                    "";

                button.textContent =
                    button.dataset.authLogoutText ||
                    "Logout";
            }
        );

    } catch (error) {

        console.warn(
            "Could not update authentication navigation:",
            error
        );
    }
}


/* =========================================================
   LOGOUT BUTTON HANDLER
========================================================= */

function setupLogoutButtons() {

    const buttons =
        document.querySelectorAll(
            "[data-auth-logout]"
        );


    buttons.forEach(
        button => {

            /*
               Prevent duplicate listeners.
            */

            if (
                button.dataset.authLogoutReady ===
                "true"
            ) {
                return;
            }


            button.dataset.authLogoutReady =
                "true";


            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    if (
                        button.disabled
                    ) {
                        return;
                    }


                    button.disabled =
                        true;


                    button.dataset.originalText =
                        button.textContent;


                    button.textContent =
                        "Logging out...";


                    await logout(
                        true
                    );
                }
            );
        }
    );
}


/* =========================================================
   INITIALIZE AUTH NAVIGATION
========================================================= */

function initializeAuthNavigation() {

    updateAuthNavigation();

    setupLogoutButtons();


    /*
       pageshow fires when returning
       to a page through browser Back/Forward.

       This is important for Nerve.
    */

    window.addEventListener(
        "pageshow",
        () => {

            updateAuthNavigation();

            setupLogoutButtons();
        }
    );


    /*
       Also refresh when the browser
       tab becomes visible again.
    */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                updateAuthNavigation();
            }
        }
    );
}


/* =========================================================
   AUTO INITIALIZE
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAuthNavigation
    );

} else {

    initializeAuthNavigation();
}
