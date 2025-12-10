import React, { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { KeyRound } from 'lucide-react-native';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { useColor } from '@/hooks/useColor';

type AuthStep = 'signIn' | 'signUp' | 'forgotPassword' | 'resetPassword' | 'secondFactor';

export const Password = () => {
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();
  const green = useColor('green');

  const [step, setStep] = useState<AuthStep>('signIn');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);

  const resetFormState = () => {
    setEmail('');
    setPassword('');
    setCode('');
    setNewPassword('');
    setTotpCode('');
    setError('');
    setLoading(false);
    setPendingVerification(false);
  };

  const changeStep = (newStep: AuthStep) => {
    resetFormState();
    setStep(newStep);
  };

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setError('Please enter a valid email address.');
      return false;
    }
    setError('');
    return true;
  };

  const validatePassword = (value: string) => {
    if (value.length < 8) {
      setError('Password must be at least 8 characters.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSignIn = async () => {
    if (!isSignInLoaded || !signIn) {
      console.log('Sign in not loaded yet');
      return;
    }
    if (!validateEmail(email) || !validatePassword(password)) return;

    setLoading(true);
    setError('');

    try {
      console.log('Attempting sign in...');
      const result = await signIn.create({
        identifier: email,
        password,
      });

      console.log('Sign in result:', result.status);

      if (result.status === 'complete') {
        console.log('Setting active session:', result.createdSessionId);
        await setSignInActive({ session: result.createdSessionId });
        console.log('Session set!');
      } else if (result.status === 'needs_second_factor') {
        console.log('2FA required, switching to second factor step');
        console.log('Available second factors:', result.supportedSecondFactors);

        // Send email code for 2FA
        try {
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
          });
          console.log('2FA email code sent to user');
        } catch (prepareErr: any) {
          console.error('Failed to prepare 2FA:', prepareErr);
        }

        setStep('secondFactor');
      } else {
        console.log('Sign in not complete, status:', result.status);
        setError(`Sign in status: ${result.status}`);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.errors?.[0]?.message || 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!isSignUpLoaded || !signUp) return;
    if (!validateEmail(email) || !validatePassword(password)) return;

    setLoading(true);
    setError('');

    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.errors?.[0]?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!isSignUpLoaded || !signUp) return;

    setLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.errors?.[0]?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    if (!isSignInLoaded || !signIn) return;
    if (!validateEmail(email)) return;

    setLoading(true);
    setError('');

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });
      setStep('resetPassword');
    } catch (err: any) {
      console.error('Send reset code error:', err);
      setError(err.errors?.[0]?.message || 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isSignInLoaded || !signIn) return;
    if (!validatePassword(newPassword)) return;
    if (code.length < 6) {
      setError('Please enter the 6-digit reset code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.errors?.[0]?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareSecondFactor = async () => {
    if (!isSignInLoaded || !signIn) return;

    setLoading(true);
    setError('');

    try {
      // Prepare email code for second factor
      await signIn.prepareSecondFactor({
        strategy: 'email_code',
      });
      console.log('2FA email code sent');
    } catch (err: any) {
      console.error('Prepare 2FA error:', err);
      setError(err.errors?.[0]?.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSecondFactor = async () => {
    if (!isSignInLoaded || !signIn) return;
    if (totpCode.length < 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: totpCode,
      });

      if (result.status === 'complete') {
        console.log('2FA complete, setting session:', result.createdSessionId);
        await setSignInActive({ session: result.createdSessionId });
      } else {
        setError(`Unexpected status: ${result.status}`);
      }
    } catch (err: any) {
      console.error('2FA error:', err);
      setError(err.errors?.[0]?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Email verification after sign up
  if (pendingVerification) {
    return (
      <Card>
        <CardHeader>
          <Text variant='title' style={{ textAlign: 'center' }}>
            Verify your email
          </Text>
          <CardDescription style={{ textAlign: 'center' }}>
            We sent a verification code to {email}
          </CardDescription>
        </CardHeader>
        <CardContent style={{ gap: 16 }}>
          <Input
            value={code}
            variant='outline'
            placeholder='Verification code'
            onChangeText={setCode}
            keyboardType='number-pad'
            editable={!loading}
          />
          {!!error && (
            <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
          )}
          <Button
            onPress={handleVerifyEmail}
            disabled={loading}
            loading={loading}
          >
            Verify Email
          </Button>
          <Button
            variant='link'
            onPress={() => {
              setPendingVerification(false);
              setCode('');
            }}
            disabled={loading}
          >
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'forgotPassword') {
    return (
      <Card>
        <CardHeader>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <KeyRound color={green} size={40} />
          </View>
          <Text variant='title' style={{ textAlign: 'center' }}>
            Reset your password
          </Text>
          <CardDescription style={{ textAlign: 'center' }}>
            Enter your email to receive a password reset code.
          </CardDescription>
        </CardHeader>
        <CardContent style={{ gap: 16 }}>
          <Input
            value={email}
            variant='outline'
            placeholder='me@example.com'
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
            autoComplete='email'
            error={error}
            editable={!loading}
          />
          <Button
            onPress={handleSendResetCode}
            disabled={loading}
            loading={loading}
          >
            Send Reset Code
          </Button>
          <Button
            variant='link'
            onPress={() => changeStep('signIn')}
            disabled={loading}
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'resetPassword') {
    return (
      <Card>
        <CardHeader>
          <Text variant='title' style={{ textAlign: 'center' }}>
            Create a new password
          </Text>
          <CardDescription style={{ textAlign: 'center' }}>
            A reset code was sent to {email}.
          </CardDescription>
        </CardHeader>
        <CardContent style={{ gap: 16 }}>
          <Input
            value={code}
            variant='outline'
            placeholder='6-digit reset code'
            onChangeText={setCode}
            keyboardType='number-pad'
            maxLength={6}
            error={error.includes('code') ? error : undefined}
            editable={!loading}
          />
          <Input
            value={newPassword}
            variant='outline'
            placeholder='New password'
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete='new-password'
            error={error.includes('password') ? error : undefined}
            editable={!loading}
          />
          <Button
            onPress={handleResetPassword}
            disabled={loading}
            loading={loading}
          >
            Reset Password
          </Button>
          <Button
            variant='link'
            onPress={() => changeStep('forgotPassword')}
            disabled={loading}
          >
            Use a different email
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'secondFactor') {
    return (
      <Card>
        <CardHeader>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <KeyRound color={green} size={40} />
          </View>
          <Text variant='title' style={{ textAlign: 'center' }}>
            Two-factor authentication
          </Text>
          <CardDescription style={{ textAlign: 'center' }}>
            We sent a verification code to {email}
          </CardDescription>
        </CardHeader>
        <CardContent style={{ gap: 16 }}>
          <Input
            value={totpCode}
            variant='outline'
            placeholder='6-digit code'
            onChangeText={setTotpCode}
            keyboardType='number-pad'
            maxLength={6}
            editable={!loading}
            autoFocus
          />
          {!!error && (
            <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
          )}
          <Button
            onPress={handleSecondFactor}
            disabled={loading}
            loading={loading}
          >
            Verify
          </Button>
          <Button
            variant='link'
            onPress={handlePrepareSecondFactor}
            disabled={loading}
          >
            Resend code
          </Button>
          <Button
            variant='link'
            onPress={() => changeStep('signIn')}
            disabled={loading}
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Default view for 'signIn' and 'signUp'
  const isSigningIn = step === 'signIn';

  return (
    <Card>
      <CardHeader>
        <CardDescription style={{ textAlign: 'center' }}>
          {isSigningIn
            ? 'Welcome back! Login to continue.'
            : 'Create an account to get started.'}
        </CardDescription>
      </CardHeader>
      <CardContent style={{ gap: 16 }}>
        {step === 'signUp' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input
              value={firstName}
              variant='outline'
              placeholder='First name'
              onChangeText={setFirstName}
              autoCapitalize='words'
              autoCorrect={false}
              editable={!loading}
              containerStyle={{ width: '49%' }}
            />
            <Input
              value={lastName}
              variant='outline'
              placeholder='Last name'
              onChangeText={setLastName}
              autoCapitalize='words'
              autoCorrect={false}
              editable={!loading}
              containerStyle={{ width: '49%' }}
            />
          </View>
        ) : null}

        <Input
          value={email}
          variant='outline'
          placeholder='me@example.com'
          onChangeText={setEmail}
          keyboardType='email-address'
          autoCapitalize='none'
          autoCorrect={false}
          autoComplete='email'
          editable={!loading}
        />
        <Input
          value={password}
          variant='outline'
          placeholder='Password'
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSigningIn ? 'current-password' : 'new-password'}
          editable={!loading}
        />
        {!!error && (
          <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
        )}

        <Button
          onPress={isSigningIn ? handleSignIn : handleSignUp}
          disabled={loading}
          loading={loading}
        >
          {isSigningIn ? 'Login' : 'Create new account'}
        </Button>

        <View
          style={{
            flexDirection: isSigningIn ? 'row' : 'column',
            justifyContent: 'space-between',
          }}
        >
          {isSigningIn && (
            <Button
              variant='link'
              disabled={loading}
              textStyle={{ fontSize: 14 }}
              onPress={() => changeStep('forgotPassword')}
            >
              Forgot password
            </Button>
          )}

          <Button
            variant='link'
            disabled={loading}
            textStyle={{ fontSize: 14 }}
            onPress={() => changeStep(isSigningIn ? 'signUp' : 'signIn')}
          >
            {isSigningIn
              ? 'Create new account'
              : 'Already have an account, Login'}
          </Button>
        </View>
      </CardContent>
    </Card>
  );
};
