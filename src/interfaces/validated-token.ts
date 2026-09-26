/** What the users service answers for a token it accepts. */
export interface ValidatedToken {
  userId: string;
  email: string;
  role: string;
}
