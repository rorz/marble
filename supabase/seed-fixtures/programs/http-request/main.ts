export default async ({ input }) => {
  const options = {
    method: input.method,
    headers: input.headers,
  };

  if (input.method !== "GET" && input.payload) {
    options.body = JSON.stringify(input.payload);
    options.headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
  }

  const res = await fetch(input.url, options);

  if (!res.ok) {
    let errorBody;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }

    throw new Error(
      JSON.stringify({
        status: res.status,
        statusText: res.statusText,
        body: errorBody,
      }),
    );
  }

  return res.json();
};
