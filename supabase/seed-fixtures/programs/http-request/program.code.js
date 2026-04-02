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
  return res.json();
};
