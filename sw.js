
/* =========================================================
   NOOR ISLAMIC APP
   Developer MASTERMIND
   Service Worker — Offline Support
========================================================= */

"use strict";

/*
  Cache version:
  নতুন ক্যাশ করা ফাইলের সংস্করণ প্রকাশের সময় এই নাম পরিবর্তন
  করলে পুরোনো ক্যাশ মুছে নতুন অ্যাপ ফাইল রাখা যাবে।
*/

const CACHE_NAME = "noor-islamic-v1";

/*
  মূল অ্যাপ ফাইলগুলো।
  এগুলো index.html-এর সঙ্গে একই Repository-র root-এ থাকবে।
*/

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];


/* =========================================================
   1. INSTALL — CACHE THE APP FILES
========================================================= */

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      /*
        মূল ফাইলগুলোর কোনোটি পাওয়া না গেলে install ব্যর্থ হবে।
        তাই ফাইলের নাম ও Repository-তে তাদের অবস্থান ঠিক রাখবে।
      */
      await cache.addAll(APP_SHELL);

      /*
        manifest.json-এ icon.svg উল্লেখ করা আছে।
        আইকন ফাইলটি তৈরি হওয়ার আগে যেন তার অভাবে
        পুরো Service Worker install ব্যর্থ না হয়।
      */
      try {
        await cache.add("./icon.svg");
      } catch {
        // icon.svg পরে যোগ করলে সেটি fetch-এর মাধ্যমে ক্যাশ হবে।
      }

      await self.skipWaiting();
    })()
  );
});


/* =========================================================
   2. ACTIVATE — REMOVE OLD APP CACHES
========================================================= */

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(name =>
            name.startsWith("noor-islamic-") &&
            name !== CACHE_NAME
          )
          .map(name => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});


/* =========================================================
   3. FETCH — SERVE CACHED FILES OFFLINE
========================================================= */

self.addEventListener("fetch", event => {
  const request = event.request;

  /*
    শুধু GET অনুরোধ এবং একই ওয়েবসাইটের ফাইল পরিচালনা করব।
    অন্য ওয়েবসাইটের অনুরোধে হস্তক্ষেপ করব না।
  */

  if (request.method !== "GET") {
    return;
  }

  const requestURL = new URL(request.url);

  if (requestURL.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      /*
        প্রথমে ক্যাশে থাকা ফাইল ব্যবহার করা হয়।
        এতে ইন্টারনেট ছাড়াই আগে থেকে সংরক্ষিত ফাইল পাওয়া যায়।
      */

      const cachedResponse = await caches.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      /*
        ক্যাশে না থাকলে অনলাইন থেকে ফাইল আনার চেষ্টা।
      */

      try {
        const networkResponse = await fetch(request);

        /*
          সফল GET response ভবিষ্যতে অফলাইনে ব্যবহারের জন্য
          ক্যাশে রাখা হবে। ব্যর্থ response ক্যাশ করা হবে না।
        */

        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);

          await cache.put(
            request,
            networkResponse.clone()
          );
        }

        return networkResponse;
      } catch {
        /*
          অফলাইনে নতুন পেজ খোলার চেষ্টা করলে মূল অ্যাপের
          ক্যাশ করা HTML দেখানোর চেষ্টা করা হবে।
        */

        if (request.mode === "navigate") {
          const offlinePage = await caches.match("./index.html");

          if (offlinePage) {
            return offlinePage;
          }
        }

        /*
          অন্য কোনো ফাইল পাওয়া না গেলে পরিষ্কার 503 response।
        */

        return new Response(
          "এই ফাইলটি এখন অফলাইনে পাওয়া যাচ্ছে না। আগে অনলাইনে খুলে আবার চেষ্টা করো।",
          {
            status: 503,
            statusText: "Offline",
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })()
  );
});


/* =========================================================
   4. MESSAGE — OPTIONAL WORKER CONTROL
========================================================= */

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
