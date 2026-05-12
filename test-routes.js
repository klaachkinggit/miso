const routes = ["", "login", "signup", "events", "tickets", "admin", "controller", "checkout"];

async function checkRoutes() {
  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000/${route}`);
      const text = await res.text();
      const hasError = text.includes("Error") || text.includes("Unhandled Runtime Error") || res.status >= 400;
      console.log(`Route /${route}: Status ${res.status}${hasError ? " (Potential Error Detected)" : " (OK)"}`);
    } catch (e) {
      console.log(`Route /${route}: Network Error - ${e.message}`);
    }
  }
}

checkRoutes();
