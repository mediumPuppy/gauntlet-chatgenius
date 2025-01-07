export interface User {
  id: string;
  username: string;
  email: string;
  is_online?: boolean;
  last_seen?: string;
}
