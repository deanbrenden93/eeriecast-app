// Shopify Storefront API Client
const SHOPIFY_DOMAIN = 'eeriecast-store.myshopify.com';
const STOREFRONT_TOKEN = 'fde7cc65823e4d3acc16635c875bd923';
const API_VERSION = '2024-01';
const ENDPOINT = `https://${SHOPIFY_DOMAIN}/api/${API_VERSION}/graphql.json`;

async function shopifyFetch(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status}`);
  }
  const json = await res.json();
  if (json.errors) {
    console.error('Shopify GraphQL errors:', json.errors);
    throw new Error(json.errors[0]?.message || 'Shopify query failed');
  }
  return json.data;
}

// ─── Products ───

export async function fetchProducts(first = 50) {
  const query = `
    query Products($first: Int!) {
      products(first: $first, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            handle
            description
            productType
            tags
            createdAt
            images(first: 4) {
              edges {
                node {
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 20) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                  selectedOptions {
                    name
                    value
                  }
                  image {
                    url
                    altText
                  }
                }
              }
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;
  const data = await shopifyFetch(query, { first });
  return data.products.edges.map(({ node }, index) => ({
    ...node,
    images: node.images.edges.map(e => e.node),
    variants: node.variants.edges.map(e => e.node),
    popularityRank: index,
  }));
}

// ─── Cart ───

export async function createCart(lines = []) {
  const query = `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await shopifyFetch(query, { input: { lines } });
  if (data.cartCreate.userErrors.length) {
    throw new Error(data.cartCreate.userErrors[0].message);
  }
  return normalizeCart(data.cartCreate.cart);
}

export async function getCart(cartId) {
  const query = `
    query Cart($cartId: ID!) {
      cart(id: $cartId) {
        ...CartFields
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await shopifyFetch(query, { cartId });
  return data.cart ? normalizeCart(data.cart) : null;
}

export async function addToCart(cartId, variantId, quantity = 1) {
  const query = `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await shopifyFetch(query, {
    cartId,
    lines: [{ merchandiseId: variantId, quantity }],
  });
  if (data.cartLinesAdd.userErrors.length) {
    throw new Error(data.cartLinesAdd.userErrors[0].message);
  }
  return normalizeCart(data.cartLinesAdd.cart);
}

export async function updateCartLine(cartId, lineId, quantity) {
  const query = `
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await shopifyFetch(query, {
    cartId,
    lines: [{ id: lineId, quantity }],
  });
  if (data.cartLinesUpdate.userErrors.length) {
    throw new Error(data.cartLinesUpdate.userErrors[0].message);
  }
  return normalizeCart(data.cartLinesUpdate.cart);
}

export async function removeFromCart(cartId, lineIds) {
  const query = `
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
    ${CART_FRAGMENT}
  `;
  const ids = Array.isArray(lineIds) ? lineIds : [lineIds];
  const data = await shopifyFetch(query, { cartId, lineIds: ids });
  if (data.cartLinesRemove.userErrors.length) {
    throw new Error(data.cartLinesRemove.userErrors[0].message);
  }
  return normalizeCart(data.cartLinesRemove.cart);
}

export async function applyDiscount(cartId, discountCode) {
  const query = `
    mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
        }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await shopifyFetch(query, {
    cartId,
    discountCodes: [discountCode],
  });
  if (data.cartDiscountCodesUpdate.userErrors.length) {
    throw new Error(data.cartDiscountCodesUpdate.userErrors[0].message);
  }
  return normalizeCart(data.cartDiscountCodesUpdate.cart);
}

// ─── Helpers ───

const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
      totalAmount {
        amount
        currencyCode
      }
    }
    discountCodes {
      code
      applicable
    }
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          cost {
            totalAmount {
              amount
              currencyCode
            }
          }
          merchandise {
            ... on ProductVariant {
              id
              title
              price {
                amount
                currencyCode
              }
              image {
                url
                altText
              }
              product {
                title
                handle
              }
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  }
`;

function normalizeCart(cart) {
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: {
      subtotal: cart.cost.subtotalAmount,
      total: cart.cost.totalAmount,
    },
    discountCodes: cart.discountCodes || [],
    lines: cart.lines.edges.map(({ node }) => ({
      id: node.id,
      quantity: node.quantity,
      cost: node.cost.totalAmount,
      variant: node.merchandise,
    })),
  };
}
