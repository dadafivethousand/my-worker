export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Handle CORS Preflight Request (OPTIONS Method)
        if (request.method === "OPTIONS") {
            return handleOptionsRequest();
        }

  

        // Automatically display all clients when accessing the root URL
        if (url.pathname === "/" && request.method === "GET") {
            try {
                const keys = await env.KV_STUDENTS.list();
                const clients = [];

                // Retrieve each client's data using the keys
                for (const key of keys.keys) {
                    const clientData = await env.KV_STUDENTS.get(key.name);
                    clients.push({
                        key: key.name,
                        data: JSON.parse(clientData),
                    });
                }

                return new Response(JSON.stringify(clients, null, 2), {
                    headers: getCorsHeaders(),
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to retrieve clients" }), {
                    status: 500,
                    headers: getCorsHeaders(),
                });
            }
        }

        // Handle POST Request to /add-client
        if (url.pathname === "/add-client" && request.method === "POST") {
            try {
                const data = await request.json();
                const key = `student:${data.email}`;

                // Save data to KV
                await env.KV_STUDENTS.put(key, JSON.stringify(data));

                return new Response(JSON.stringify({ message: "Client added successfully!" }), {
                    headers: getCorsHeaders(),
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to process request" }), {
                    status: 500,
                    headers: getCorsHeaders(),
                });
            }
        }

        // Handle POST Request to /edit-client
        if (url.pathname === "/edit-client" && request.method === "POST") {
            try {
                const { key, data } = await request.json();
                await env.KV_STUDENTS.put(key, JSON.stringify(data));
                return new Response(JSON.stringify({ message: "Client updated successfully!" }), {
                    headers: getCorsHeaders(),
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to update client" }), {
                    status: 500,
                    headers: getCorsHeaders(),
                });
            }
        }

        // Handle DELETE Request to /delete-client
        if (url.pathname === "/delete-client" && request.method === "DELETE") {
            try {
                const { key } = await request.json();
                await env.KV_STUDENTS.delete(key);
                return new Response(JSON.stringify({ message: "Client deleted successfully!" }), {
                    headers: getCorsHeaders(),
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to delete client" }), {
                    status: 500,
                    headers: getCorsHeaders(),
                });
            }
        }

        // Fallback for Other Routes
        return new Response("Not Found", {
            status: 404,
            headers: getCorsHeaders(),
        });
    },
};


// Function to Handle OPTIONS Request
function handleOptionsRequest() {
    return new Response(null, {
        headers: {
            ...getCorsHeaders(),
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}

// Function to Get CORS Headers
function getCorsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*", // Adjust this to your domain for better security
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    };
}
