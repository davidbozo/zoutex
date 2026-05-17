import { z } from "zod";

export const UserSchema = z
  .object({ id: z.uuid(), name: z.string(), email: z.email() })
  .meta({ id: "User" });

export const PostSchema = z
  .object({ id: z.string().uuid(), title: z.string(), content: z.string() })
  .meta({ id: "Post" });

export const ErrorSchema = z
  .object({ message: z.string() })
  .meta({ id: "Error" });
