import "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the name must match React's own declaration for the merge to apply
  interface InputHTMLAttributes<T> {
    /**
     * Non-standard, but supported everywhere that matters: lets a file input
     * pick a whole directory. React does not declare it.
     */
    webkitdirectory?: string;
  }
}
