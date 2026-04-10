export default async ({ input }) => {
  throw new Error(
    `SQL execution for ${input.connection.dialect} is not yet implemented`,
  );
};
