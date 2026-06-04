/**
 * Cognito Authentication Service
 *
 * TODO: Fill in COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID
 * after Member A creates the Cognito User Pool.
 */

import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  getCurrentUser as amplifyGetCurrentUser,
  signOut as amplifySignOut,
  fetchAuthSession,
} from "aws-amplify/auth";

// Cognito configuration - Member A will provide these values
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_jijBmZk13",
      userPoolClientId: "1n6j3vvt3gahq48sl969fhdmls",
      loginWith: {
        email: true,
      },
    },
  },
});


export async function signIn(email, password) {
  const result = await amplifySignIn({ username: email, password });
  return result;
}

export async function signUp(email, password, givenName, familyName) {
  const result = await amplifySignUp({
    username: email,
    password,
    options: {
      userAttributes: {
        email,
        given_name: givenName,
        family_name: familyName,
      },
    },
  });
  return result;
}

export async function confirmSignUp(email, code) {
  const result = await amplifyConfirmSignUp({
    username: email,
    confirmationCode: code,
  });
  return result;
}

export async function getCurrentUser() {
  const user = await amplifyGetCurrentUser();
  return user;
}

export async function getAuthToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

export async function logout() {
  await amplifySignOut();
}
