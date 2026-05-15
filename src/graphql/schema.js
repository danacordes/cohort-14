export const typeDefs = `#graphql
  type Query {
    _empty: String
  }
`;

export const resolvers = {
  Query: {
    _empty: () => null,
  },
};
