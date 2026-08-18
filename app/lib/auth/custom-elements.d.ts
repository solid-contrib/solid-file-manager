import type { DetailedHTMLProps, HTMLAttributes } from "react";
import type {
  AuthorizationCodeFlow,
  IdpPicker,
  WebIdPicker,
} from "@solid/reactive-authentication";

type CustomElement<T> = DetailedHTMLProps<HTMLAttributes<T>, T>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "authorization-code-flow": CustomElement<AuthorizationCodeFlow>;
      "idp-picker": CustomElement<IdpPicker>;
      "webid-picker": CustomElement<WebIdPicker>;
    }
  }
}
