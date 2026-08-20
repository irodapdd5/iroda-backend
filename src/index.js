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
      // SCHEDULES
      // ==================================================

      // ==========================
      // GET SEMUA JADWAL
      // ==========================

      if (
        url.pathname === "/schedules" &&
        request.method === "GET"
      ) {

        const result =
          await env.DB
            .prepare(`
              SELECT
                id,
                title,
                schedule_date,
                schedule_time,
                location,
                description,
                created_at
              FROM schedules
              ORDER BY
                schedule_date ASC,
                schedule_time ASC,
                id ASC
            `)
            .all();


        return Response.json({

          success: true,

          schedules:
            result.results || []

        }, {
          headers
        });

      }


      // ==========================
      // SCHEDULE ID
      // ==========================

      const scheduleMatch =
        url.pathname.match(
          /^\/schedules\/(\d+)$/
        );


      // ==========================
      // GET SATU JADWAL
      // ==========================

      if (
        scheduleMatch &&
        request.method === "GET"
      ) {

        const id =
          Number(scheduleMatch[1]);


        const schedule =
          await env.DB
            .prepare(`
              SELECT
                id,
                title,
                schedule_date,
                schedule_time,
                location,
                description,
                created_at
              FROM schedules
              WHERE id = ?
            `)
            .bind(id)
            .first();


        if (!schedule) {

          return Response.json({

            success: false,

            message:
              "Jadwal tidak ditemukan"

          }, {
            status: 404,
            headers
          });

        }


        return Response.json({

          success: true,

          schedule

        }, {
          headers
        });

      }


      // ==========================
      // TAMBAH JADWAL
      // ==========================

      if (
        url.pathname === "/schedules" &&
        request.method === "POST"
      ) {

        const body =
          await request.json();


        const title =
          typeof body.title === "string"
            ? body.title.trim()
            : "";

        const schedule_date =
          typeof body.schedule_date === "string"
            ? body.schedule_date.trim()
            : "";

        const schedule_time =
          typeof body.schedule_time === "string"
            ? body.schedule_time.trim()
            : "";

        const location =
          typeof body.location === "string"
            ? body.location.trim()
            : "";

        const description =
          typeof body.description === "string"
            ? body.description.trim()
            : "";


        // ==========================
        // VALIDASI
        // ==========================

        if (
          !title ||
          !schedule_date
        ) {

          return Response.json({

            success: false,

            message:
              "Judul dan tanggal wajib diisi"

          }, {
            status: 400,
            headers
          });

        }


        // ==========================
        // INSERT
        // ==========================

        const result =
          await env.DB
            .prepare(`
              INSERT INTO schedules
              (
                title,
                schedule_date,
                schedule_time,
                location,
                description
              )

              VALUES (?, ?, ?, ?, ?)
            `)
            .bind(
              title,
              schedule_date,
              schedule_time || null,
              location || null,
              description || null
            )
            .run();


        return Response.json({

          success: true,

          message:
            "Jadwal berhasil dibuat",

          schedule_id:
            result.meta.last_row_id

        }, {
          status: 201,
          headers
        });

      }


      // ==========================
      // UPDATE JADWAL
      // ==========================

      if (
        scheduleMatch &&
        request.method === "PUT"
      ) {

        const id =
          Number(scheduleMatch[1]);


        const body =
          await request.json();


        const title =
          typeof body.title === "string"
            ? body.title.trim()
            : "";

        const schedule_date =
          typeof body.schedule_date === "string"
            ? body.schedule_date.trim()
            : "";

        const schedule_time =
          typeof body.schedule_time === "string"
            ? body.schedule_time.trim()
            : "";

        const location =
          typeof body.location === "string"
            ? body.location.trim()
            : "";

        const description =
          typeof body.description === "string"
            ? body.description.trim()
            : "";


        // ==========================
        // VALIDASI
        // ==========================

        if (
          !title ||
          !schedule_date
        ) {

          return Response.json({

            success: false,

            message:
              "Judul dan tanggal wajib diisi"

          }, {
            status: 400,
            headers
          });

        }


        // ==========================
        // UPDATE
        // ==========================

        const result =
          await env.DB
            .prepare(`
              UPDATE schedules

              SET
                title = ?,
                schedule_date = ?,
                schedule_time = ?,
                location = ?,
                description = ?

              WHERE id = ?
            `)
            .bind(
              title,
              schedule_date,
              schedule_time || null,
              location || null,
              description || null,
              id
            )
            .run();


        if (
          result.meta.changes === 0
        ) {

          return Response.json({

            success: false,

            message:
              "Jadwal tidak ditemukan"

          }, {
            status: 404,
            headers
          });

        }


        return Response.json({

          success: true,

          message:
            "Jadwal berhasil diperbarui"

        }, {
          headers
        });

      }


      // ==========================
      // DELETE JADWAL
      // ==========================

      if (
        scheduleMatch &&
        request.method === "DELETE"
      ) {

        const id =
          Number(scheduleMatch[1]);


        // ==========================
        // DELETE
        // ==========================

        const result =
          await env.DB
            .prepare(`
              DELETE FROM schedules
              WHERE id = ?
            `)
            .bind(id)
            .run();


        if (
          result.meta.changes === 0
        ) {

          return Response.json({

            success: false,

            message:
              "Jadwal tidak ditemukan"

          }, {
            status: 404,
            headers
          });

        }


        return Response.json({

          success: true,

          message:
            "Jadwal berhasil dihapus"

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
