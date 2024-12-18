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

        if (url.pathname === "/scan" && request.method === "POST") {
            try {
              
                await handleExpiringMemberships(env);
                return new Response(JSON.stringify({ message: "Sweep Completed" }), {
                    headers: getCorsHeaders(),
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to Sweep" }), {
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

    // Cron job function
    async scheduled(event, env) {
        console.log("Cron job triggered");
        await handleExpiringMemberships(env);
    },
};


async function handleExpiringMemberships(env) {
    console.log("Checking for expiring memberships...");
    const today = new Date();
    const keys = await env.KV_STUDENTS.list();
    const memberships = [];

    // Retrieve all membership records
    for (const key of keys.keys) {
        const memberData = await env.KV_STUDENTS.get(key.name);
        memberships.push({ key: key.name, data: JSON.parse(memberData) });
    }

    // Filter memberships expiring within 7 days
    const membershipsExpiringSoon = memberships.filter((member) => {
        const endDate = new Date(member.data.endDate);
        const daysToExpiry = (endDate - today) / (1000 * 60 * 60 * 24);
        return daysToExpiry <= 7 && daysToExpiry > 0 && !member.data.expiringSoon;
    });

    console.log(`Found ${membershipsExpiringSoon.length} membership(s) expiring soon`);

    // Iterate and send reminder emails
    for (const member of membershipsExpiringSoon) {
        try {
            const formattedEndDate = new Date(member.data.endDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const capitalizedFirstName =
            member.data.firstName.charAt(0).toUpperCase() + member.data.firstName.slice(1).toLowerCase();

            const body = `
                <p>Dear ${capitalizedFirstName},</p>
                <p>This is a friendly reminder that your membership at Maple Jiu-Jitsu Academy is set to expire on <strong>${formattedEndDate}</strong>.</p>
                <p>We value your continued training and would love to have you stay with us! You can renew your membership conveniently:</p>
                <ul>
                    <li>Online at <a href="http://maplebjj.com" target="_blank">maplebjj.com</a></li>
                    <li>In person at the academy</li>
                </ul>
                <p>If you have any questions or need assistance, please don’t hesitate to reach out.</p>

                <br>
                <div style="font-family:'Trebuchet MS',sans-serif; color:#383b3e;">
                    <p>Sincerely,</p>
                    <p><strong>Maple Jiu-Jitsu Academy</strong></p>
                    <img src="https://i.imgur.com/b8kPby1.png" alt="Maple Jiu-Jitsu" width="96" height="43"><br>
                    <p>📞 647-887-9940<br>
                    ✉️ <a href="mailto:admin@maplebjj.com">admin@maplebjj.com</a><br>
                    🌐 <a href="http://maplebjj.com" target="_blank">Maplebjj.com</a><br>
                    📍 20 Cranston Park Ave, Maple, ON L6A2G1</p>
                </div>
            `;

            await sendEmail({
                recipient: member.data.email,
                subject: "Maple Jiu-Jitsu Membership Expiring Soon",
                body,
            });

            // Update the KV entry to mark the reminder as sent
      
            member.data.expiringSoon = true;
            await env.KV_STUDENTS.put(member.key, JSON.stringify(member.data));
            console.log(`Reminder sent to ${member.data.email}`);
        } catch (error) {
            console.error(`Failed to send email to ${member.data.email}:`, error);
        }
    }
}

async function sendEmail({ recipient, subject, body }) {
    const smtpData = {
        api_key: 'api-E590F5313DC444E7AC02A68775937CF8', // Replace with your actual key
        to: [recipient],
        sender: '"Maple Jiu-Jitsu" <admin@maplebjj.com>',
        subject,
        html_body: body,
    };

    await fetch("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpData),
    });
    console.log(`Email sent to ${recipient}`);
}

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
