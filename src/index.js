export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    // ==========================
    // TEST API
    // ==========================
    if (url.pathname === "/" && request.method === "GET") {
      return Response.json({
        success: true,
        message: "IRODA API Running 🚀"
      }, { headers });
    }

    // ==========================
    // LOGIN ADMIN
    // ==========================
    if (url.pathname === "/login" && request.method === "POST") {
      try {
        const { name, password } = await request.json();

        if (!name || !password) {
          return Response.json({
            success: false,
            message: "Nama dan password wajib diisi"
          }, {
            status: 400,
            headers
          });
        }

        const admin = await env.DB
          .prepare(
            "SELECT id, name FROM admins WHERE name = ? AND password = ?"
          )
          .bind(name, password)
          .first();

        if (!admin) {
          return Response.json({
            success: false,
            message: "Nama atau password salah"
          }, {
            status: 401,
            headers
          });
        }

        return Response.json({
          success: true,
          message: "Login berhasil",
          admin
        }, { headers });

      } catch (err) {
        return Response.json({
          success: false,
          message: err.message
        }, {
          status: 500,
          headers
        });
      }
    }

    // ==========================
    // 404
    // ==========================
    return Response.json({
      success: false,
      message: "Endpoint tidak ditemukan"
    }, {
      status: 404,
      headers
    });
  }
};
