import { generateReactHelpers, generateUploadButton } from "@uploadthing/react";
import type { UploadRouter } from "@/app/api/uploadthing/core";

export const UploadButton = generateUploadButton<UploadRouter>();
export const { useUploadThing } = generateReactHelpers<UploadRouter>();
