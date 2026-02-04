import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// =============================================================================
// THEME COLORS (inline to avoid import issues)
// =============================================================================
const colors = {
  gradientTop: '#E8C4B8',
  gradientMiddle: '#D4A574',
  gradientBottom: '#A67B5B',
  honey: '#F8B430',
  taupe: '#C4A47C',
  white: '#FFFFFF',
  cream: '#FAF7F2',
  champagne: '#E8E2D9',
  slateGrey: '#D1D1D1',
  textPrimary: '#1A1A1A',
  textSecondary: '#5E5E5E',
  textBrown: '#5D3A1A',
  maroon: '#5D1F1F',
};

// =============================================================================
// STEP DEFINITIONS
// =============================================================================

const STEPS = {
  SPLASH: 'splash',
  WELCOME: 'welcome',
  USER_TYPE: 'userType',
  NAME: 'name',
  EMAIL: 'email',        // NEW: Email/password step
  LOCATION: 'location',
  HAIR_INTRO: 'hairIntro',
  HAIR_TYPE: 'hairType',
  HAIR_POROSITY: 'hairPorosity',
  HAIR_GOALS: 'hairGoals',
  LOADING: 'loading',
  COMPLETE: 'complete',
};

const STEP_ORDER = [
  STEPS.SPLASH,
  STEPS.WELCOME,
  STEPS.USER_TYPE,
  STEPS.NAME,
  STEPS.EMAIL,           // NEW
  STEPS.LOCATION,
  STEPS.HAIR_INTRO,
  STEPS.HAIR_TYPE,
  STEPS.HAIR_POROSITY,
  STEPS.HAIR_GOALS,
  STEPS.LOADING,
  STEPS.COMPLETE,
];

// Steps that show progress indicator
const PROGRESS_STEPS = [
  STEPS.USER_TYPE,
  STEPS.NAME,
  STEPS.EMAIL,           // NEW
  STEPS.LOCATION,
  STEPS.HAIR_TYPE,
  STEPS.HAIR_POROSITY,
  STEPS.HAIR_GOALS,
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OnboardingScreen({ onDone, onSignIn }) {
  const [currentStep, setCurrentStep] = useState(STEPS.SPLASH);
  const [formData, setFormData] = useState({
    userType: null,
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    location: '',
    hairType: null,
    hairPorosity: null,
    hairGoals: [],
  });
  const [signupError, setSignupError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const loadingProgress = useRef(new Animated.Value(0)).current;
  const [loadingMessage, setLoadingMessage] = useState('Creating your account...');

  // Auto-advance from splash after delay
  useEffect(() => {
    if (currentStep === STEPS.SPLASH) {
      const timer = setTimeout(() => goToStep(STEPS.WELCOME), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Handle loading/signup
  useEffect(() => {
    if (currentStep === STEPS.LOADING) {
      handleSignup();
    }
  }, [currentStep]);

  const handleSignup = async () => {
    setSignupError(null);
    loadingProgress.setValue(0);
    
    // Animate progress
    Animated.timing(loadingProgress, {
      toValue: 0.3,
      duration: 500,
      useNativeDriver: false,
    }).start();

    setLoadingMessage('Creating your account...');

    try {
      // Generate username from email
      const username = formData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Call Supabase signup
      const { user, error } = await authService.signUp(
        formData.email.trim(),
        formData.password,
        {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          username: username,
          location: formData.location,
          hairType: formData.hairType,
          porosity: formData.hairPorosity,
          hairGoals: formData.hairGoals,
          userType: formData.userType,
        }
      );

      if (error) {
        console.error('Signup error:', error);
        setSignupError(error.message || 'Failed to create account');
        // Go back to email step
        goToStep(STEPS.EMAIL);
        Alert.alert('Signup Failed', error.message || 'Please try again');
        return;
      }

      // Progress animation
      Animated.timing(loadingProgress, {
        toValue: 0.6,
        duration: 500,
        useNativeDriver: false,
      }).start();

      setLoadingMessage('Setting up your hair profile...');

      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));

      Animated.timing(loadingProgress, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();

      setLoadingMessage('Almost there...');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Success! Go to complete
      goToStep(STEPS.COMPLETE);

    } catch (err) {
      console.error('Unexpected signup error:', err);
      setSignupError(err.message || 'Something went wrong');
      goToStep(STEPS.EMAIL);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const goToStep = (step) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(step);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const goNext = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      goToStep(STEP_ORDER[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      goToStep(STEP_ORDER[currentIndex - 1]);
    }
  };

  const updateFormData = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleHairGoal = (goal) => {
    setFormData((prev) => ({
      ...prev,
      hairGoals: prev.hairGoals.includes(goal)
        ? prev.hairGoals.filter((g) => g !== goal)
        : [...prev.hairGoals, goal],
    }));
  };

  const handleComplete = () => {
    if (onDone) onDone();
  };

  // Validation helpers
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isEmailStepValid = () => {
    return (
      isValidEmail(formData.email) &&
      formData.password.length >= 6 &&
      formData.password === formData.confirmPassword
    );
  };

  // =============================================================================
  // PROGRESS INDICATOR
  // =============================================================================

  const renderProgressIndicator = () => {
    const progressIndex = PROGRESS_STEPS.indexOf(currentStep);
    if (progressIndex === -1) return null;

    return (
      <View style={styles.progressContainer}>
        {PROGRESS_STEPS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index <= progressIndex && styles.progressDotActive,
            ]}
          />
        ))}
      </View>
    );
  };

  // =============================================================================
  // BACK BUTTON
  // =============================================================================

  const renderBackButton = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex <= 1) return null; // Don't show on splash, welcome, or first question

    if (currentStep === STEPS.USER_TYPE){
      return(
        <TouchableOpacity style={styles.backButton} onPress={() => goToStep(STEPS.WELCOME)}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
    );
  };

  // =============================================================================
  // RENDER STEPS
  // =============================================================================

  const renderSplash = () => (
    <GradientScreen>
      <View style={styles.splashContent}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoTextDark}>cr</Text>
          <Text style={styles.logoCrownDark}>♛</Text>
          <Text style={styles.logoTextDark}>n</Text>
        </View>
        <Text style={styles.taglineDark}>every crown tells a story.</Text>
      </View>
    </GradientScreen>
  );

  const renderWelcome = () => (
    <GradientScreen>
      <View style={styles.welcomeContent}>
        <Text style={styles.logoText}>crwn.</Text>
        <Text style={styles.tagline}>Every crown tells a story.</Text>
      </View>
      <View style={styles.welcomeButtons}>
        <TouchableOpacity style={styles.createAccountButton} onPress={goNext}>
          <Text style={styles.createAccountText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSignIn}>
          <Text style={styles.signInText}>
            Have an account? <Text style={styles.signInLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </GradientScreen>
  );

  const renderUserType = () => (
    <WhiteScreen>
      {renderBackButton()}
      {renderProgressIndicator()}
      <Text style={styles.questionTitle}>How would you like to use CRWN?</Text>
      <Text style={styles.questionSubtitle}>
        This shapes your feed and experience.
      </Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.optionButton,
            formData.userType === 'explorer' && styles.optionButtonSelected,
          ]}
          onPress={() => updateFormData('userType', 'explorer')}
        >
          <Text
            style={[
              styles.optionText,
              formData.userType === 'explorer' && styles.optionTextSelected,
            ]}
          >
            I am here to explore
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionButton,
            formData.userType === 'stylist' && styles.optionButtonSelected,
          ]}
          onPress={() => updateFormData('userType', 'stylist')}
        >
          <Text
            style={[
              styles.optionText,
              formData.userType === 'stylist' && styles.optionTextSelected,
            ]}
          >
            I am a hairstylist
          </Text>
        </TouchableOpacity>
      </View>

      <ContinueButton onPress={goNext} disabled={!formData.userType} />
    </WhiteScreen>
  );

  const renderName = () => (
    <WhiteScreen>
      {renderBackButton()}
      {renderProgressIndicator()}
      <Text style={styles.questionTitle}>What's your name?</Text>
      <Text style={styles.questionSubtitle}>
        This helps us personalize your experience.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>First name</Text>
        <TextInput
          style={styles.input}
          value={formData.firstName}
          onChangeText={(text) => updateFormData('firstName', text)}
          placeholder="Enter your first name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Last name</Text>
        <TextInput
          style={styles.input}
          value={formData.lastName}
          onChangeText={(text) => updateFormData('lastName', text)}
          placeholder="Enter your last name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
      </View>

      <ContinueButton onPress={goNext} disabled={!formData.firstName} />
    </WhiteScreen>
  );

  // NEW: Email/Password step
  const renderEmail = () => (
    <WhiteScreen scrollable>
      {renderBackButton()}
      {renderProgressIndicator()}
      <Text style={styles.questionTitle}>Create your account</Text>
      <Text style={styles.questionSubtitle}>
        Enter your email and create a password.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => updateFormData('email', text.toLowerCase())}
          placeholder="you@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {formData.email.length > 0 && !isValidEmail(formData.email) && (
          <Text style={styles.errorText}>Please enter a valid email</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={formData.password}
            onChangeText={(text) => updateFormData('password', text)}
            placeholder="At least 6 characters"
            placeholderTextColor="#999"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color="#999"
            />
          </TouchableOpacity>
        </View>
        {formData.password.length > 0 && formData.password.length < 6 && (
          <Text style={styles.errorText}>Password must be at least 6 characters</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          value={formData.confirmPassword}
          onChangeText={(text) => updateFormData('confirmPassword', text)}
          placeholder="Re-enter your password"
          placeholderTextColor="#999"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        {formData.confirmPassword.length > 0 &&
          formData.password !== formData.confirmPassword && (
            <Text style={styles.errorText}>Passwords don't match</Text>
          )}
      </View>

      <ContinueButton onPress={goNext} disabled={!isEmailStepValid()} />
    </WhiteScreen>
  );

  const renderLocation = () => (
    <WhiteScreen>
      {renderBackButton()}
      {renderProgressIndicator()}
      <Text style={styles.questionTitle}>Where are you located?</Text>
      <Text style={styles.questionSubtitle}>
        We'll show you stylists near you.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>City, State</Text>
        <TextInput
          style={styles.input}
          value={formData.location}
          onChangeText={(text) => updateFormData('location', text)}
          placeholder="e.g., Atlanta, GA"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
      </View>

      <ContinueButton onPress={goNext} disabled={!formData.location} />
    </WhiteScreen>
  );

  const renderHairIntro = () => (
    <GradientScreen>
      <View style={styles.hairIntroContent}>
        <Text style={styles.hairIntroTitle}>Your Hair is Unique.</Text>
        <Text style={styles.hairIntroSubtitle}>
          Answer a few quick questions about your hair to tailor your feed,
          recommendations, and matches.
        </Text>
      </View>
      <View style={styles.hairIntroButton}>
        <TouchableOpacity style={styles.whiteButton} onPress={goNext}>
          <Text style={styles.whiteButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </GradientScreen>
  );

  const renderHairType = () => {
    const hairTypes = [
      { id: '1', label: 'Type 1 (Straight)' },
      { id: '2', label: 'Type 2 (Wavy)' },
      { id: '3A', label: 'Type 3A' },
      { id: '3B', label: 'Type 3B' },
      { id: '3C', label: 'Type 3C' },
      { id: '4A', label: 'Type 4A' },
      { id: '4B', label: 'Type 4B' },
      { id: '4C', label: 'Type 4C' },
    ];

    return (
      <WhiteScreen scrollable>
        {renderBackButton()}
        {renderProgressIndicator()}
        <Text style={styles.questionTitle}>What is your hair type?</Text>
        <Text style={styles.questionSubtitle}>
          Select the option that best describes your hair texture.
        </Text>

        <View style={styles.hairTypeGrid}>
          {hairTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.hairTypeCard,
                formData.hairType === type.id && styles.hairTypeCardSelected,
              ]}
              onPress={() => updateFormData('hairType', type.id)}
            >
              <Text
                style={[
                  styles.hairTypeText,
                  formData.hairType === type.id && styles.hairTypeTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ContinueButton onPress={goNext} disabled={!formData.hairType} />
      </WhiteScreen>
    );
  };

  const renderHairPorosity = () => {
    const porosityOptions = [
      { value: 'Low', description: 'Hair takes long to get wet and dry' },
      { value: 'Medium', description: 'Hair absorbs and retains moisture well' },
      { value: 'High', description: 'Hair gets wet quickly and dries fast' },
    ];

    return (
      <WhiteScreen>
        {renderBackButton()}
        {renderProgressIndicator()}
        <Text style={styles.questionTitle}>What's your hair porosity?</Text>
        <Text style={styles.questionSubtitle}>
          Not sure? Think about how your hair absorbs water.
        </Text>

        <View style={styles.porosityOptions}>
          {porosityOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.porosityOption,
                formData.hairPorosity === option.value && styles.porosityOptionSelected,
              ]}
              onPress={() => updateFormData('hairPorosity', option.value)}
            >
              <Text
                style={[
                  styles.porosityText,
                  formData.hairPorosity === option.value && styles.porosityTextSelected,
                ]}
              >
                {option.value} Porosity
              </Text>
              <Text style={styles.porosityDescription}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ContinueButton onPress={goNext} disabled={!formData.hairPorosity} />
      </WhiteScreen>
    );
  };

  const renderHairGoals = () => {
    const goals = [
      'Hair growth',
      'Damage repair',
      'Length retention',
      'Hydration & moisture',
      'Learn tips & techniques',
      'Find new styles',
      'Connect with stylists',
    ];

    return (
      <WhiteScreen scrollable>
        {renderBackButton()}
        {renderProgressIndicator()}
        <Text style={styles.questionTitle}>What are your hair goals?</Text>
        <Text style={styles.questionSubtitle}>
          Select all that apply. We'll personalize your experience.
        </Text>

        <View style={styles.goalsContainer}>
          {goals.map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[
                styles.goalOption,
                formData.hairGoals.includes(goal) && styles.goalOptionSelected,
              ]}
              onPress={() => toggleHairGoal(goal)}
            >
              <Text
                style={[
                  styles.goalText,
                  formData.hairGoals.includes(goal) && styles.goalTextSelected,
                ]}
              >
                {goal}
              </Text>
              {formData.hairGoals.includes(goal) && (
                <Ionicons name="checkmark-circle" size={22} color={colors.honey} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <ContinueButton
          onPress={goNext}
          disabled={formData.hairGoals.length === 0}
        />
      </WhiteScreen>
    );
  };

  const renderLoading = () => (
    <GradientScreen>
      <View style={styles.loadingContent}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingCircle}>
            <ActivityIndicator size="large" color={colors.honey} />
          </View>
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </View>
      </View>
    </GradientScreen>
  );

  const renderComplete = () => (
    <GradientScreen>
      <View style={styles.completeContent}>
        <View style={styles.completeCard}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color={colors.white} />
          </View>
          <Text style={styles.completeTitle}>Welcome to CRWN!</Text>
          <Text style={styles.completeSubtitle}>
            Your profile is ready. Let's explore your crown.
          </Text>
        </View>
      </View>
      <View style={styles.completeButtonContainer}>
        <TouchableOpacity style={styles.whiteButton} onPress={handleComplete}>
          <Text style={styles.whiteButtonText}>Explore Your CRWN</Text>
        </TouchableOpacity>
      </View>
    </GradientScreen>
  );

  // =============================================================================
  // STEP RENDERER
  // =============================================================================

  const renderCurrentStep = () => {
    switch (currentStep) {
      case STEPS.SPLASH:
        return renderSplash();
      case STEPS.WELCOME:
        return renderWelcome();
      case STEPS.USER_TYPE:
        return renderUserType();
      case STEPS.NAME:
        return renderName();
      case STEPS.EMAIL:
        return renderEmail();
      case STEPS.LOCATION:
        return renderLocation();
      case STEPS.HAIR_INTRO:
        return renderHairIntro();
      case STEPS.HAIR_TYPE:
        return renderHairType();
      case STEPS.HAIR_POROSITY:
        return renderHairPorosity();
      case STEPS.HAIR_GOALS:
        return renderHairGoals();
      case STEPS.LOADING:
        return renderLoading();
      case STEPS.COMPLETE:
        return renderComplete();
      default:
        return renderSplash();
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {renderCurrentStep()}
    </Animated.View>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const GradientScreen = ({ children }) => (
  <LinearGradient
    colors={[colors.gradientTop, colors.gradientMiddle, colors.gradientBottom]}
    locations={[0, 0.5, 1]}
    style={styles.gradientContainer}
  >
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  </LinearGradient>
);

const WhiteScreen = ({ children, scrollable }) => (
  <SafeAreaView style={styles.whiteContainer} edges={['top', 'bottom']}>
    {scrollable ? (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.whiteContentScrollable}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    ) : (
      <View style={styles.whiteContent}>{children}</View>
    )}
  </SafeAreaView>
);

const ContinueButton = ({ onPress, disabled }) => (
  <View style={styles.continueButtonContainer}>
    <TouchableOpacity
      style={[styles.continueButton, disabled && styles.continueButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.continueButtonText}>Continue</Text>
    </TouchableOpacity>
  </View>
);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Gradient Screen
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // White Screen
  whiteContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  whiteContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  whiteContentScrollable: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Back Button
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginLeft: -8,
  },

  // Progress Indicator
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.champagne,
  },
  progressDotActive: {
    backgroundColor: colors.honey,
  },

  // Splash & Welcome
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 17,
    color: colors.white,
    marginTop: 12,
    fontStyle: 'italic',
  },

  // Welcome Buttons
  welcomeButtons: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  createAccountButton: {
    backgroundColor: colors.taupe,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  createAccountText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  signInText: {
    color: colors.white,
    fontSize: 14,
  },
  signInLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Questions
  questionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  questionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },

  // Options (User Type)
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: colors.slateGrey,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderColor: colors.honey,
    backgroundColor: colors.cream,
  },
  optionText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.textBrown,
    fontWeight: '500',
  },

  // Inputs
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slateGrey,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.slateGrey,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
  },
  eyeButton: {
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },

  // Continue Button
  continueButtonContainer: {
    marginTop: 'auto',
    paddingBottom: 32,
  },
  continueButton: {
    backgroundColor: colors.taupe,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },

  // Hair Intro
  hairIntroContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hairIntroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 12,
  },
  hairIntroSubtitle: {
    fontSize: 15,
    color: colors.white,
    lineHeight: 22,
    opacity: 0.9,
  },
  hairIntroButton: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  // White Button (on gradient)
  whiteButton: {
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  whiteButtonText: {
    color: colors.textBrown,
    fontSize: 15,
    fontWeight: '600',
  },

  // Hair Type Grid
  hairTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  hairTypeCard: {
    width: (SCREEN_WIDTH - 24 * 2 - 12) / 2,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: colors.slateGrey,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hairTypeCardSelected: {
    borderColor: colors.honey,
    backgroundColor: colors.cream,
  },
  hairTypeText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  hairTypeTextSelected: {
    color: colors.textBrown,
    fontWeight: '500',
  },

  // Porosity Options
  porosityOptions: {
    gap: 12,
    marginBottom: 24,
  },
  porosityOption: {
    borderWidth: 1,
    borderColor: colors.slateGrey,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  porosityOptionSelected: {
    borderColor: colors.honey,
    backgroundColor: colors.cream,
  },
  porosityText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
  },
  porosityTextSelected: {
    color: colors.textBrown,
  },
  porosityDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Goals
  goalsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.slateGrey,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  goalOptionSelected: {
    borderColor: colors.honey,
    backgroundColor: colors.cream,
  },
  goalText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  goalTextSelected: {
    color: colors.textBrown,
    fontWeight: '500',
  },

  // Loading
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  loadingCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textBrown,
    textAlign: 'center',
  },

  // Complete
  completeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  completeCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.honey,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textBrown,
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  completeButtonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
});
