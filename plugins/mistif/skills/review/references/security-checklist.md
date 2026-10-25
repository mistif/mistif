# Security checklist

Walk only the areas the change touches.

- **Input**: validated at the edge for type, size, range and shape; rejected, not repaired, when wrong.
- **Queries**: parameterised. No string-built SQL, shell commands, paths or templates from user input.
- **Output**: encoded for where it lands (HTML, attribute, URL, JSON, shell). No raw user text in markup.
- **Authorisation**: every request checks who the caller is and that they own or may access this object, on the server. Hiding a button is not a check.
- **Sessions and tokens**: random, expiring, rotated on login, stored so scripts cannot read them, revoked on logout.
- **Headers and CORS**: restrictive by default, with named origins and no wildcard with credentials.
- **Uploads**: type, size and content checked; stored outside the web root under a generated name; never executed.
- **Secrets**: not in code, logs, URLs, error messages or client bundles. Loaded from the environment or a vault.
- **Outbound requests built from user input**: allow-list the destination; block internal and metadata addresses; limit redirects and size.
- **Destructive paths**: file deletes and overwrites confined to an intended folder; resolve the path and check it before acting.
- **Rate limits**: on login, reset, signup and anything costly.
- **Dependencies**: needed, maintained, pinned, and with no install scripts you have not read.
- **Privacy**: collect the minimum, keep it for a stated time, keep personal data out of logs.
- **Model output**: treat it as untrusted input before it reaches a shell, a query, a file path or another prompt.

## Ask the person first
A new authentication flow, a new class of sensitive data, an external integration, changes to CORS, upload or rate-limit rules, and any grant of extra privilege.
