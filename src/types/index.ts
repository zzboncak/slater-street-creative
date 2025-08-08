export type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  image: string; // URL or public path
  tags?: string[];
};

export type CartItem = {
  product: Product;
  quantity: number;
};
