const API_URL = "https://dare-backend-vx8w.onrender.com";

/* =========================================================
   API REQUEST
========================================================= */

async function apiFetch(path, options = {}) {
    const config = {
        credentials: "include",
        ...options,
        headers: {
            ...(options.headers || {})
        }
    };

    if (
        config.body &&
        typeof config.body !== "string"
    ) {
        config.headers["Content-Type"] =
            "application/json";

        config.body =
            JSON.stringify(config.body);
    }

    const response =
        await fetch(
            `${API_URL}${path}`,
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

        const error =
            new Error(message);

        error.status =
            response.status;

        error.code =
            data?.error?.code;

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
    return await apiFetch(
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
}


/* =========================================================
   LOGIN
========================================================= */

async function login(
    email,
    password
) {
    return await apiFetch(
        "/api/auth/login",
        {
            method: "POST",
            body: {
                email,
                password
            }
        }
    );
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
        console.warn(
            "Logout request failed:",
            error
        );
    }

    /*
     * Old localStorage authentication data
     * from the previous system is no longer trusted.
     */
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    if (redirect) {
        window.location.href =
            "login.html";
    }
}


/* =========================================================
   CURRENT USER
========================================================= */

let currentUserCache =
    undefined;


/*
 * Returns the authenticated user.
 *
 * null = not authenticated
 * object = authenticated
 */
async function getCurrentUserAsync() {

    if (
        currentUserCache !==
        undefined
    ) {
        return currentUserCache;
    }

    try {

        const result =
            await apiFetch(
                "/api/auth/me"
            );

        currentUserCache =
            result?.data?.user ||
            null;

        return currentUserCache;

    } catch (error) {

        if (
            error.status === 401
        ) {
            currentUserCache =
                null;

            return null;
        }

        throw error;
    }
}


/*
 * Synchronous compatibility helper.
 *
 * New code should prefer
 * getCurrentUserAsync().
 */
function getCurrentUser() {

    const cached =
        localStorage.getItem(
            "user"
        );

    if (!cached) {
        return null;
    }

    try {
        return JSON.parse(cached);
    } catch (_) {
        return null;
    }
}


/* =========================================================
   LOGIN CHECK
========================================================= */

async function isLoggedInAsync() {

    const user =
        await getCurrentUserAsync();

    return !!user;
}


function isLoggedIn() {

    /*
     * Compatibility only.
     *
     * Cookie sessions cannot be checked
     * synchronously from JavaScript.
     */
    return false;
}


/* =========================================================
   PROTECT PAGE
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

        window.location.href =
            "login.html";

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

            currentUserCache =
                null;

            localStorage.removeItem(
                "user"
            );

            window.location.href =
                "login.html";

            return null;
        }

        throw error;
    }
}


/* =========================================================
   AUTHENTICATED API RESPONSE
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
   CACHE MANAGEMENT
========================================================= */

function clearAuthCache() {

    currentUserCache =
        undefined;

    localStorage.removeItem(
        "user"
    );

    localStorage.removeItem(
        "token"
    );
}
