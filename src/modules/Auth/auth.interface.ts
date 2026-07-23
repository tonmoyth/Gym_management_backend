export type IUserRegistration = {
  fullName: string;
  email: string;
  password: string;
  profileImage?: string;
  role: string;
};

export type IUserLogin = {
  email: string;
  password: string;
};
