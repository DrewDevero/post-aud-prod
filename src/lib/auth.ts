export const COOKIE_NAME = "sp-user";

export interface User {
  id: string;
  name: string;
}

export const TEST_USERS: User[] = [
  { id: "user-1", name: "User 1" },
  { id: "user-2", name: "User 2" },
];
