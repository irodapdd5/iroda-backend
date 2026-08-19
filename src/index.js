export default {
  async fetch(request, env) {

    // ==========================
    // CORS
    // ==========================

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods":
        "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type",
      "Content-Type":
        "application/json"
    };


    // ==========================
    // PREFLIGHT
    // ==========================

    if (request.method === "OPTIONS") {

      return new Response(null, {
        status: 204,
        headers
      });

    }


    const url =
      new URL(request.url);


    try {

      // ==================================================
      // TEST API
      // ==================================================

      if (
        url.pathname === "/" &&
        request.method === "GET"
      ) {

        return Response.json({

          success: true,

          message:
            "IRODA API Running 🚀"

        }, {
          headers
        });

      }


      // ==================================================
      // LOGIN ADMIN
      // ==================================================

      if (
        url.pathname === "/login" &&
        request.method === "POST"
      ) {

        const {
          name,
          password
        } = await request.json();


        if (!name || !password) {

          return Response.json({

            success: false,

            message:
              "Nama dan password wajib diisi"

          }, {
            status: 400,
            headers
          });

        }


        const admin =
          await env.DB
            .prepare(`
              SELECT
                id,
                name
              FROM admins
              WHERE name = ?
              AND password = ?
            `)
            .bind(
              name,
              password
            )
            .first();


        if (!admin) {

          return Response.json({

            success: false,

            message:
              "Nama atau password salah"

          }, {
            status: 401,
            headers
          });

        }


        return Response.json({

          success: true,

          message:
            "Login berhasil",

          admin

        }, {
          headers
        });

      }


      // ==================================================
      // GET SEMUA EVENT
      // ==================================================

      if (
        url.pathname === "/events" &&
        request.method === "GET"
      ) {

        const result =
          await env.DB
            .prepare(`
              SELECT

                e.id,
                e.year,
                e.name,
                e.description,
                e.image,
                e.created_at,

                (
                  SELECT
                    MIN(ed.event_date)

                  FROM event_dates ed

                  WHERE
                    ed.event_id = e.id

                ) AS first_date

              FROM events e

              ORDER BY
                first_date DESC,
                e.id DESC
            `)
            .all();


        return Response.json({

          success: true,

          data:
            result.results || []

        }, {
          headers
        });

      }


      // ==================================================
      // EVENT ID
      // ==================================================

      const eventMatch =
        url.pathname.match(
          /^\/events\/(\d+)$/
        );


      // ==================================================
      // GET SATU EVENT
      // ==================================================

      if (
        eventMatch &&
        request.method === "GET"
      ) {

        const id =
          Number(eventMatch[1]);


        const event =
          await env.DB
            .prepare(`
              SELECT

                id,
                year,
                name,
                description,
                image,
                created_at

              FROM events

              WHERE id = ?
            `)
            .bind(id)
            .first();


        if (!event) {

          return Response.json({

            success: false,

            message:
              "Event tidak ditemukan"

          }, {
            status: 404,
            headers
          });

        }


        const dates =
          await env.DB
            .prepare(`
              SELECT

                id,
                event_date,
                drive_link

              FROM event_dates

              WHERE event_id = ?

              ORDER BY
                event_date ASC,
                id ASC
            `)
            .bind(id)
            .all();


        return Response.json({

          success: true,

          event,

          dates:
            dates.results || []

        }, {
          headers
        });

      }


      // ==================================================
      // TAMBAH EVENT
      // ==================================================

      if (
        url.pathname === "/events" &&
        request.method === "POST"
      ) {

        const body =
          await request.json();


        const year =
          body.year;

        const name =
          typeof body.name === "string"
            ? body.name.trim()
            : "";

        const description =
          typeof body.description === "string"
            ? body.description.trim()
            : "";

        const image =
          typeof body.image === "string"
            ? body.image
            : "";

        const dates =
          Array.isArray(body.dates)
            ? body.dates
            : [];


        // ==========================
        // VALIDASI EVENT
        // ==========================

        if (
          !year ||
          !name
        ) {

          return Response.json({

            success: false,

            message:
              "Tahun dan nama kegiatan wajib diisi"

          }, {
            status: 400,
            headers
          });

        }


        // ==========================
        // VALIDASI TANGGAL
        // ==========================

        const cleanDates =
          dates
            .filter(date =>
              date &&
              date.event_date &&
              date.drive_link
            )
            .map(date => ({

              event_date:
                String(date.event_date),

              drive_link:
                String(date.drive_link).trim()

            }))
            .filter(date =>
              date.drive_link !== ""
            );


        if (
          cleanDates.length === 0
        ) {

          return Response.json({

            success: false,

            message:
              "Minimal satu tanggal dan link Google Drive wajib diisi"

          }, {
            status: 400,
            headers
          });

        }


        // ==========================
        // INSERT EVENT
        // ==========================

        const result =
          await env.DB
            .prepare(`
              INSERT INTO events
              (
                year,
                name,
                description,
                image
              )

              VALUES (?, ?, ?, ?)
            `)
            .bind(
              Number(year),
              name,
              description,
              image
            )
            .run();


        const eventId =
          result.meta.last_row_id;


        // ==========================
        // INSERT TANGGAL
        // ==========================

        for (
          const date of cleanDates
        ) {

          await env.DB
            .prepare(`
              INSERT INTO event_dates
              (
                event_id,
                event_date,
                drive_link
              )

              VALUES (?, ?, ?)
            `)
            .bind(
              eventId,
              date.event_date,
              date.drive_link
            )
            .run();

        }


        return Response.json({

          success: true,

          message:
            "Event berhasil dibuat",

          event_id:
            eventId

        }, {
          status: 201,
          headers
        });

      }


      // ==================================================
      // UPDATE EVENT
      // ==================================================

      if (
        eventMatch &&
        request.method === "PUT"
      ) {

        const id =
          Number(eventMatch[1]);


        const body =
          await request.json();


        // ==========================
        // CEK EVENT
        // ==========================

        const existing =
          await env.DB
            .prepare(`
              SELECT
                id,
                image
              FROM events
              WHERE id = ?
            `)
            .bind(id)
            .first();


        if (!existing) {

          return Response.json({

            success: false,

            message:
              "Event tidak ditemukan"

          }, {
            status: 404,
            headers
          });

        }


        // ==========================
        // DATA EVENT
        // ==========================

        const year =
          body.year;

        const name =
          typeof body.name === "string"
            ? body.name.trim()
            : "";

        const description =
          typeof body.description === "string"
            ? body.description.trim()
            : "";


        // ==========================
        // FOTO
        //
        // Jika image tidak dikirim:
        // gunakan foto lama.
        //
        // Jika image = "":
        // hapus foto.
        //
        // Jika image berisi data baru:
        // gunakan foto baru.
        // ==========================

        let image;


        if (
          Object.prototype.hasOwnProperty.call(
            body,
            "image"
          )
        ) {

          image =
            typeof body.image === "string"
              ? body.image
              : "";

        } else {

          image =
            existing.image || "";

        }


        // ==========================
        // VALIDASI
        // ==========================

        if (
          !year ||
          !name
        ) {

          return Response.json({

            success: false,

            message:
              "Tahun dan nama kegiatan wajib diisi"

          }, {
            status: 400,
            headers
          });

        }


        // ==========================
        // TANGGAL
        // ==========================

        const dates =
          Array.isArray(body.dates)
            ? body.dates
            : [];


        const cleanDates =
          dates
            .filter(date =>
              date &&
              date.event_date &&
              date.drive_link
            )
            .map(date => ({

              event_date:
                String(date.event_date),

              drive_link:
                String(date.drive_link).trim()

            }))
            .filter(date =>
              date.drive_link !== ""
            );


        // ==========================
        // MINIMAL 1 TANGGAL
        // ==========================

        if (
          cleanDates.length === 0
        ) {

          return Response.json({

            success: false,

            message:
              "Minimal satu tanggal dan link Google Drive wajib ada"

          }, {
            status: 400,
            headers
          });

        }


        // ==========================
        // UPDATE EVENT
        // ==========================

        await env.DB
          .prepare(`
            UPDATE events

            SET
              year = ?,
              name = ?,
              description = ?,
              image = ?

            WHERE id = ?
          `)
          .bind(
            Number(year),
            name,
            description,
            image,
            id
          )
          .run();


        // ==========================
        // HAPUS SEMUA TANGGAL LAMA
        // ==========================
        //
        // Ini sengaja dilakukan.
        //
        // Setelah itu kita masukkan
        // kembali hanya tanggal yang
        // dikirim dari frontend.
        //
        // Jadi tanggal yang dihapus
        // dari form otomatis terhapus
        // dari database.
        //
        // Tanggal yang diedit otomatis
        // menggunakan data baru.
        // ==========================

        await env.DB
          .prepare(`
            DELETE FROM event_dates
            WHERE event_id = ?
          `)
          .bind(id)
          .run();


        // ==========================
        // INSERT TANGGAL BARU
        // ==========================

        for (
          const date of cleanDates
        ) {

          await env.DB
            .prepare(`
              INSERT INTO event_dates
              (
                event_id,
                event_date,
                drive_link
              )

              VALUES (?, ?, ?)
            `)
            .bind(
              id,
              date.event_date,
              date.drive_link
            )
            .run();

        }


        return Response.json({

          success: true,

          message:
            "Event berhasil diperbarui"

        }, {
          headers
        });

      }


      // ==================================================
      // DELETE EVENT
      // ==================================================

      if (
        eventMatch &&
        request.method === "DELETE"
      ) {

        const id =
          Number(eventMatch[1]);


        // ==========================
        // CEK EVENT
        // ==========================

        const existing =
          await env.DB
            .prepare(`
              SELECT id
              FROM events
              WHERE id = ?
            `)
            .bind(id)
            .first();


        if (!existing) {

          return Response.json({

            success: false,

            message:
              "Event tidak ditemukan"

          }, {
            status: 404,
            headers
          });

        }


        // ==========================
        // HAPUS TANGGAL
        // ==========================

        await env.DB
          .prepare(`
            DELETE FROM event_dates
            WHERE event_id = ?
          `)
          .bind(id)
          .run();


        // ==========================
        // HAPUS EVENT
        // ==========================

        await env.DB
          .prepare(`
            DELETE FROM events
            WHERE id = ?
          `)
          .bind(id)
          .run();


        return Response.json({

          success: true,

          message:
            "Event berhasil dihapus"

        }, {
          headers
        });

      }


      // ==================================================
      // 404
      // ==================================================

      return Response.json({

        success: false,

        message:
          "Endpoint tidak ditemukan"

      }, {
        status: 404,
        headers
      });


    } catch (error) {

      console.error(
        "IRODA API ERROR:",
        error
      );


      return Response.json({

        success: false,

        message:
          error.message ||
          "Terjadi kesalahan pada server"

      }, {
        status: 500,
        headers
      });

    }

  }
};
