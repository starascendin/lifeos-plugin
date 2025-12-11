import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-expo';
import { KeyRound, MailCheck } from 'lucide-react-native';
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
import { InputOTP } from '@/components/ui/input-otp';
import { useColor } from '@/hooks/useColor';

type AuthStep = 'signIn' | 'verifyEmail';

export const EmailOTP = () => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const green = useColor('green');

  const [step, setStep] = useState<AuthStep>('signIn');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetFormState = () => {
    setEmail('');
    setCode('');
    setError('');
    setLoading(false);
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

  const handleSendCode = async () => {
    if (!isLoaded || !signIn) return;
    if (!validateEmail(email)) return;

    setLoading(true);
    setError('');

    try {
      await signIn.create({
        strategy: 'email_code',
        identifier: email,
      });

      setStep('verifyEmail');
    } catch (err: any) {
      console.error('Send code error:', err);
      setError(err.errors?.[0]?.message || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!isLoaded || !signIn) return;
    if (code.length < 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'email_code',
        code,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      console.error('Email verification error:', err);
      setError(err.errors?.[0]?.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verifyEmail') {
    return (
      <Card>
        <CardContent>
          <View style={{ gap: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <MailCheck color={green} size={40} />
            </View>
            <View style={{ gap: 8 }}>
              <Text variant='title' style={{ textAlign: 'center' }}>
                Check your email
              </Text>
              <Text variant='subtitle' style={{ textAlign: 'center' }}>
                {`We've sent a 6-digit code to ${email}`}
              </Text>
            </View>
            <InputOTP
              length={6}
              value={code}
              onChangeText={setCode}
              onComplete={handleVerifyEmail}
            />
            {!!error && (
              <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
            )}
            <Button
              onPress={handleVerifyEmail}
              disabled={loading || code.length < 6}
              loading={loading}
            >
              Verify Code
            </Button>
            <Button
              variant='link'
              onPress={() => changeStep('signIn')}
              disabled={loading}
            >
              Use a different email
            </Button>
          </View>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <KeyRound color={green} size={40} />
        </View>
        <Text variant='title' style={{ textAlign: 'center' }}>
          OTP Email Login
        </Text>
        <CardDescription style={{ textAlign: 'center' }}>
          Enter your email to receive OTP code.
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
        <Button onPress={handleSendCode} disabled={loading} loading={loading}>
          Send Code
        </Button>
      </CardContent>
    </Card>
  );
};
