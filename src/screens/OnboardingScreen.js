import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { stylistService } from '../services/stylistService';
import { useAuth } from '../hooks/useAuth';
import { AUTH_URL } from '../lib/auth-url';
import { getAuthToken } from '../lib/auth-client';
import AuthScreen from './AuthScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import { HAIR_STYLE_CATEGORIES, HAIR_STYLES } from '../constants/hairStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Skeleton-card gradients cycled across the STYLES_LOADING placeholder grid so
// it reads as a varied shimmer instead of one flat color repeated.
const SKELETON_GRADIENTS = [
  ['#EDE4D8', '#DCCBB4'],
  ['#E4E4E2', '#CFCFCB'],
  ['#E8D9C8', '#CBB08C'],
  ['#EFE6DC', '#DED0BE'],
  ['#DEE1DE', '#C7CCC7'],
  ['#EAD9C7', '#D2B896'],
];

const colors = {
  gradientTop: '#E8C4B8',
  gradientMiddle: '#D4A574',
  gradientBottom: '#A67B5B',
  white: '#FFFFFF',
  cream: '#FAF7F2',
  textPrimary: '#1A1A1A',
  textSecondary: '#5E5E5E',
  textBrown: '#5D3A1A',
  maroon: '#5D1F1F',
  forest: '#3F523F',
  copper: '#C4956A',
  honey: '#F8B430',
  burntOchre: '#B35D2B',
};

// Gradient configs cycled by AnimatedGradientBackground (shared by the
// completion and stylist-buffer screens). Each entry also nudges `start`/`end`
// so the gradient's origin drifts along with the color crossfade instead of
// just tinting in place.
const SUNSET_GRADIENTS = [
  { colors: ['#F2C9A8', '#E8A87C', '#E8C4A8'], locations: [0, 0.5, 1], start: { x: 0, y: 0 }, end: { x: 0.8, y: 1 } },
  { colors: ['#E8A87C', 'rgba(248,180,48,0.35)', '#FCFCFC'], locations: [0, 0.5, 1], start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  { colors: ['#FCFCFC', '#F2C9A8', '#E8C4A8'], locations: [0, 0.5, 1], start: { x: 0, y: 0.2 }, end: { x: 1, y: 1 } },
  { colors: ['#E8C4A8', '#C2B093', '#E8A87C'], locations: [0, 0.5, 1], start: { x: 0.2, y: 0 }, end: { x: 0.9, y: 1 } },
];

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = {
  SPLASH: 'splash',
  WELCOME: 'welcome',
  EMAIL: 'email',
  NAME: 'name',
  PHONE_VERIFY: 'phoneVerify',
  USERNAME: 'username',
  LOCATION: 'location',
  PROFILE_PHOTO: 'profilePhoto',
  USER_TYPE: 'userType',
  // stylist import path
  STYLIST_IMPORT: 'stylistImport',
  STYLIST_INSTAGRAM: 'stylistInstagram',
  STYLIST_REVIEW: 'stylistReview',
  // stylist buffer / manual path
  STYLIST_BUFFER: 'stylistBuffer',
  STYLIST_WORK_TYPE: 'stylistWorkType',
  STYLIST_EXPERIENCE: 'stylistExperience',
  STYLIST_SPECIALTIES: 'stylistSpecialties',
  STYLIST_BUSINESS_NAME: 'stylistBusinessName',
  STYLIST_CREDENTIALS: 'stylistCredentials',
  STYLIST_BOOKING_LINK: 'stylistBookingLink',
  STYLIST_SOCIAL_LINKS: 'stylistSocialLinks',
  STYLIST_AVAILABILITY: 'stylistAvailability',
  STYLIST_BOOKING: 'stylistBooking',
  STYLIST_PORTFOLIO: 'stylistPortfolio',
  STYLIST_FIND_CREATORS: 'stylistFindCreators',
  // explorer path
  USAGE_GOALS: 'usageGoals',
  STYLES_LOADING: 'stylesLoading',
  HAIR_STYLES: 'hairStyles',
  CREATORS: 'creators',
  DISCOVER_STYLISTS: 'discoverStylists',
  ENDING_BUFFER: 'endingBuffer',
};

// Import flow order (steps 1–3 of the new-stylist wizard)
const IMPORT_STEP_ORDER = [
  STEPS.STYLIST_IMPORT,
  STEPS.STYLIST_INSTAGRAM,
  STEPS.STYLIST_REVIEW,
];

// Active stylist-path order (8 screens) — used for both navigation and its progress bar
const STYLIST_STEP_ORDER = [
  STEPS.STYLIST_WORK_TYPE,
  STEPS.STYLIST_EXPERIENCE,
  STEPS.STYLIST_SPECIALTIES,
  STEPS.STYLIST_BUSINESS_NAME,
  STEPS.STYLIST_CREDENTIALS,
  STEPS.STYLIST_BOOKING_LINK,
  STEPS.STYLIST_SOCIAL_LINKS,
  STEPS.STYLIST_PORTFOLIO,
  STEPS.STYLIST_INSTAGRAM,
];

// Old stylist-path order — kept for reference / easy re-enabling, no longer wired into navigation
const LEGACY_STYLIST_STEP_ORDER = [
  STEPS.STYLIST_WORK_TYPE,
  STEPS.STYLIST_EXPERIENCE,
  STEPS.STYLIST_SPECIALTIES,
  STEPS.STYLIST_BUSINESS_NAME,
  STEPS.STYLIST_AVAILABILITY,
  STEPS.STYLIST_BOOKING,
  STEPS.STYLIST_PORTFOLIO,
  STEPS.STYLIST_FIND_CREATORS,
];

// Linear base order used for back-button navigation on pre-branch steps
const BASE_STEP_ORDER = [
  STEPS.SPLASH,
  STEPS.WELCOME,
  STEPS.EMAIL,
  STEPS.PHONE_VERIFY,
  STEPS.USERNAME,
  STEPS.PROFILE_PHOTO,
  STEPS.LOCATION,
  STEPS.USER_TYPE,
];

// ── Progress bar groups ─────────────────────────────────────────────────────
// Each group below renders its own dot-bar; the active group is found by membership of currentStep.
const MAIN_STEPS = [
  STEPS.EMAIL,
  STEPS.PHONE_VERIFY,
  STEPS.USERNAME,
  STEPS.PROFILE_PHOTO,
  STEPS.LOCATION,
  STEPS.USER_TYPE,
];

const EXPLORER_PROGRESS_STEPS = [
  STEPS.STYLES_LOADING,
  STEPS.HAIR_STYLES,
];

// EXPLORER_PROGRESS_STEPS is no longer rendered — usage goals, the loading screen, and the
// styles grid are all progress-bar-free in the explorer flow.
const PROGRESS_GROUPS = [MAIN_STEPS, IMPORT_STEP_ORDER, STYLIST_STEP_ORDER];

// Old flat progress bar — kept for reference / easy re-enabling, no longer used by renderProgress
const PROGRESS_STEPS = [
  STEPS.EMAIL,
  STEPS.NAME,
  STEPS.LOCATION,
  STEPS.PROFILE_PHOTO,
  STEPS.USER_TYPE,
  ...LEGACY_STYLIST_STEP_ORDER,
  STEPS.HAIR_STYLES,
  STEPS.CREATORS,
  STEPS.DISCOVER_STYLISTS,
  STEPS.ENDING_BUFFER,
];

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CREATORS = [
  { id: 'c1', username: 'naturalnaya',   tag: '4C · Wash & Go',    colors: ['#C4956A', '#8B5E3C'], height: 200 },
  { id: 'c2', username: 'afrodiaspora',  tag: '4A · Growth',       colors: ['#2C1810', '#1A0F08'], height: 230 },
  { id: 'c3', username: 'twistqueen__',  tag: '3C · Protective',   colors: ['#5D1F1F', '#3D1010'], height: 220 },
  { id: 'c4', username: 'kinkandkrown',  tag: '4C · Moisture',     colors: ['#C4783A', '#8B4E1E'], height: 240 },
  { id: 'c5', username: 'zuri.curls',    tag: '3B · Curl Care',    colors: ['#D4C4B0', '#B09880'], height: 210 },
  { id: 'c6', username: 'sofrosyne__',   tag: '4B · Big Chop',     colors: ['#3D2B1F', '#1A1208'], height: 225 },
];

const MOCK_STYLISTS = [
  { id: 's1', username: 'naturalnaya',   specialty: 'Locs · Natural',       colors: ['#3F523F', '#2C3B2C'], height: 210 },
  { id: 's2', username: 'afrodiaspora',  specialty: 'Silk Press · Color',   colors: ['#5D1F1F', '#3D1010'], height: 240 },
  { id: 's3', username: 'twistqueen__',  specialty: 'Braids · Twists',      colors: ['#C4783A', '#8B4E1E'], height: 220 },
  { id: 's4', username: 'kinkandkrown',  specialty: 'Wash & Go · Natural',  colors: ['#8B6E4E', '#5D4A34'], height: 230 },
  { id: 's5', username: 'curlsbyzia',    specialty: '4B · Locs',            colors: ['#1A1208', '#0D0804'], height: 200 },
  { id: 's6', username: 'zuri.curls',    specialty: '3B · Curl Care',       colors: ['#D4C4B0', '#B09880'], height: 215 },
  { id: 's7', username: 'sofrosyne__',   specialty: '4B · Big Chop',        colors: ['#3D2B1F', '#1A1208'], height: 225 },
];

const HAIR_STYLE_OPTIONS = [
  'Braids', 'Locs', 'Twists', 'Natural / Wash & Go',
  'Protective Styles', 'Silk Press', 'Color & Highlights',
  'Big Chop / TWA', 'Wigs & Extensions', 'Fades & Tapers',
];

const STYLIST_SPECIALTY_OPTIONS = [
  'Locs & loc maintenance',
  'Box braids & protective styles',
  'Silk press & blowouts',
  'Natural styles & wash & go',
  'Twists & twist outs',
  'Wigs & installs',
  'Color & highlights',
  'Cuts & fades',
  'Keratin & relaxers',
];

const STYLIST_FILTERS = ['All', 'Near Me', 'Locs', 'Braids', 'Natural'];

// "How do you want to use CRWN?" — explorer-path goals screen (multi-select)
const USAGE_GOAL_OPTIONS = [
  'Learn what works for my hair',
  'Document and track my journey',
  'Discover products for my hair type',
  'Get inspired by styles and looks',
  'Find and connect with stylists',
  'Share my journey with others',
];

// Hair "looks" grid shown on the redesigned HAIR_STYLES / STYLES_LOADING screens.
// Data + images now live in src/constants/hairStyles.js (single source of truth).
const STYLE_FILTER_CHIPS = HAIR_STYLE_CATEGORIES;

// ── Main component ────────────────────────────────────────────────────────────

// ── US location data ─────────────────────────────────────────────────────────
const US_STATES = [
  { abbr: 'AL', name: 'Alabama' }, { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' }, { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' }, { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' }, { abbr: 'DE', name: 'Delaware' },
  { abbr: 'DC', name: 'Washington D.C.' }, { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' }, { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' }, { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' }, { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' }, { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' }, { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' }, { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' }, { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' }, { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' }, { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' }, { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' }, { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' }, { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' }, { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' }, { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' }, { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' }, { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' }, { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' }, { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' }, { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' }, { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
];

const US_CITIES = {
  AL: ['Birmingham','Montgomery','Huntsville','Mobile','Tuscaloosa','Hoover','Auburn','Dothan','Decatur'],
  AK: ['Anchorage','Fairbanks','Juneau','Sitka','Wasilla','Kenai','Kodiak'],
  AZ: ['Phoenix','Tucson','Mesa','Chandler','Scottsdale','Gilbert','Glendale','Tempe','Peoria','Flagstaff','Yuma'],
  AR: ['Little Rock','Fort Smith','Fayetteville','Springdale','Jonesboro','Conway','Rogers','Bentonville'],
  CA: ['Los Angeles','San Diego','San Jose','San Francisco','Fresno','Sacramento','Long Beach','Oakland','Bakersfield','Anaheim','Santa Ana','Riverside','Stockton','Chula Vista','Irvine','Modesto','Compton','Inglewood','Pasadena','Pomona','Torrance','San Bernardino','Fontana'],
  CO: ['Denver','Colorado Springs','Aurora','Fort Collins','Lakewood','Thornton','Arvada','Westminster','Pueblo','Boulder'],
  CT: ['Bridgeport','New Haven','Hartford','Stamford','Waterbury','Norwalk','Danbury','New Britain'],
  DC: ['Washington'],
  DE: ['Wilmington','Dover','Newark','Middletown','Smyrna','Milford'],
  FL: ['Jacksonville','Miami','Tampa','Orlando','St. Petersburg','Hialeah','Tallahassee','Cape Coral','Fort Lauderdale','Pembroke Pines','Hollywood','Gainesville','Miramar','Coral Springs','West Palm Beach','Lakeland','Miami Gardens','Boca Raton','Clearwater','Pompano Beach'],
  GA: ['Atlanta','Augusta','Columbus','Macon','Savannah','Athens','Sandy Springs','Roswell','Johns Creek','Albany','Warner Robins','Alpharetta','Marietta','Smyrna','Valdosta','Brookhaven','Dunwoody'],
  HI: ['Honolulu','Pearl City','Hilo','Kailua','Waipahu','Kaneohe','Kahului'],
  ID: ['Boise','Nampa','Meridian','Idaho Falls','Pocatello','Caldwell','Twin Falls'],
  IL: ['Chicago','Aurora','Rockford','Joliet','Naperville','Springfield','Peoria','Elgin','Waukegan','Champaign','Bloomington','Evanston','Cicero'],
  IN: ['Indianapolis','Fort Wayne','Evansville','South Bend','Carmel','Fishers','Bloomington','Hammond','Gary','Lafayette','Muncie','Terre Haute'],
  IA: ['Des Moines','Cedar Rapids','Davenport','Sioux City','Iowa City','Waterloo','Ames','Ankeny','Dubuque'],
  KS: ['Wichita','Overland Park','Kansas City','Olathe','Topeka','Lawrence','Shawnee','Manhattan','Lenexa'],
  KY: ['Louisville','Lexington','Bowling Green','Owensboro','Covington','Richmond','Georgetown','Florence','Elizabethtown'],
  LA: ['New Orleans','Baton Rouge','Shreveport','Metairie','Lafayette','Lake Charles','Kenner','Bossier City','Monroe','Alexandria'],
  ME: ['Portland','Lewiston','Bangor','South Portland','Auburn','Augusta'],
  MD: ['Baltimore','Frederick','Rockville','Gaithersburg','Bowie','Hagerstown','Annapolis','Columbia','Silver Spring','Germantown'],
  MA: ['Boston','Worcester','Springfield','Lowell','Cambridge','New Bedford','Brockton','Quincy','Lynn','Fall River','Newton','Somerville','Lawrence'],
  MI: ['Detroit','Grand Rapids','Warren','Sterling Heights','Ann Arbor','Lansing','Flint','Dearborn','Livonia','Troy','Farmington Hills','Kalamazoo','Pontiac'],
  MN: ['Minneapolis','Saint Paul','Rochester','Duluth','Bloomington','Brooklyn Park','Plymouth','Saint Cloud','Woodbury','Burnsville'],
  MS: ['Jackson','Gulfport','Southaven','Biloxi','Hattiesburg','Olive Branch','Tupelo','Meridian','Starkville'],
  MO: ['Kansas City','St. Louis','Springfield','Columbia','Independence','Lee\'s Summit','O\'Fallon','St. Joseph','Joplin'],
  MT: ['Billings','Missoula','Great Falls','Bozeman','Butte','Helena','Kalispell'],
  NE: ['Omaha','Lincoln','Bellevue','Grand Island','Kearney','Fremont','Norfolk'],
  NV: ['Las Vegas','Henderson','Reno','North Las Vegas','Sparks','Carson City'],
  NH: ['Manchester','Nashua','Concord','Dover','Rochester','Salem'],
  NJ: ['Newark','Jersey City','Paterson','Elizabeth','Trenton','Camden','Clifton','Passaic','Union City','East Orange','Bayonne','Irvington','New Brunswick','Edison'],
  NM: ['Albuquerque','Las Cruces','Rio Rancho','Santa Fe','Roswell','Farmington','Hobbs'],
  NY: ['New York City','Brooklyn','Queens','The Bronx','Staten Island','Buffalo','Rochester','Yonkers','Syracuse','Albany','New Rochelle','Mount Vernon','Schenectady','Utica','White Plains','Harlem','Niagara Falls'],
  NC: ['Charlotte','Raleigh','Greensboro','Durham','Winston-Salem','Fayetteville','Cary','Wilmington','High Point','Concord','Gastonia','Asheville','Chapel Hill','Huntersville'],
  ND: ['Fargo','Bismarck','Grand Forks','Minot','West Fargo','Dickinson'],
  OH: ['Columbus','Cleveland','Cincinnati','Toledo','Akron','Dayton','Parma','Canton','Youngstown','Lorain','Hamilton','Springfield','Kettering'],
  OK: ['Oklahoma City','Tulsa','Norman','Broken Arrow','Lawton','Edmond','Moore','Enid','Stillwater'],
  OR: ['Portland','Eugene','Salem','Gresham','Hillsboro','Beaverton','Bend','Medford','Corvallis'],
  PA: ['Philadelphia','Pittsburgh','Allentown','Erie','Reading','Scranton','Bethlehem','Lancaster','Harrisburg','York','Wilkes-Barre'],
  RI: ['Providence','Cranston','Warwick','Pawtucket','East Providence','Woonsocket','Newport'],
  SC: ['Columbia','Charleston','North Charleston','Mount Pleasant','Rock Hill','Greenville','Summerville','Hilton Head Island','Florence','Spartanburg','Myrtle Beach'],
  SD: ['Sioux Falls','Rapid City','Aberdeen','Brookings','Watertown','Pierre'],
  TN: ['Memphis','Nashville','Knoxville','Chattanooga','Clarksville','Murfreesboro','Franklin','Jackson','Johnson City','Bartlett','Hendersonville'],
  TX: ['Houston','San Antonio','Dallas','Austin','Fort Worth','El Paso','Arlington','Corpus Christi','Plano','Lubbock','Laredo','Garland','Irving','Amarillo','Grand Prairie','McKinney','Frisco','Brownsville','Pasadena','Killeen','McAllen','Mesquite','Denton','Waco','Round Rock','Sugar Land','Tyler','Beaumont','League City'],
  UT: ['Salt Lake City','West Valley City','Provo','West Jordan','Orem','Sandy','Ogden','St. George','Layton','South Jordan'],
  VT: ['Burlington','South Burlington','Rutland','Barre','Montpelier'],
  VA: ['Virginia Beach','Norfolk','Chesapeake','Richmond','Newport News','Alexandria','Hampton','Roanoke','Portsmouth','Suffolk','Lynchburg','Harrisonburg','Charlottesville','Arlington'],
  WA: ['Seattle','Spokane','Tacoma','Vancouver','Bellevue','Kent','Renton','Federal Way','Kirkland','Bellingham','Everett','Yakima'],
  WV: ['Charleston','Huntington','Morgantown','Parkersburg','Wheeling','Beckley'],
  WI: ['Milwaukee','Madison','Green Bay','Kenosha','Racine','Appleton','Waukesha','Oshkosh','Eau Claire','Janesville'],
  WY: ['Cheyenne','Casper','Laramie','Gillette','Rock Springs','Sheridan'],
};

export default function OnboardingScreen({ onDone = () => {} }) {
  const { signInWithGoogle, signUp, user: authUser } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(STEPS.SPLASH);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    username: '',
    location: '',
    profilePhoto: null,
    userType: null,
    // explorer fields
    usageGoals: [],
    selectedStyles: [],
    followedCreators: [],
    followedStylists: [],
    // stylist fields
    stylistWorkType: null,
    stylistExperience: null,
    stylistSpecialties: [],
    businessName: '',
    stylistAvailability: null,
    credentialsPhoto: null,
    bookingLink: '',
    socialLinks: { instagram: '', tiktok: '', other: '' },
  });
  const [services, setServices] = useState([{ name: '', price: '' }]);
  const [portfolioPhotos, setPortfolioPhotos] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailError, setUsernameAvailError] = useState('');
  const [stylistFilter, setStylistFilter] = useState('All');
  const [hairLookFilter, setHairLookFilter] = useState('Protective');
  const [phoneStage, setPhoneStage] = useState('enter'); // 'enter' | 'code'
  const [phoneCode, setPhoneCode] = useState('');
  const [locStateAbbr, setLocStateAbbr] = useState('');
  const [locCity, setLocCity] = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  // Import flow state
  const [importUrl, setImportUrl] = useState('');
  const [importedData, setImportedData] = useState(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [instagramPhotos, setInstagramPhotos] = useState([]); // { url, caption }[]
  const [selectedInstagramPhotos, setSelectedInstagramPhotos] = useState([]); // url string[]
  const [instagramCaptionEdits, setInstagramCaptionEdits] = useState({}); // { [url]: string }
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [stylistPath, setStylistPath] = useState('import'); // 'import' | 'manual'
  const skeletonPulse = useRef(new Animated.Value(0.4)).current;
  const signupInProgress = useRef(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Returning user: signed in via the internal AuthScreen (not Google).
  // authUser will be set but isGoogleUser is false and showAuth is true.
  // Call onDone so AppContent treats them as having completed onboarding.
  useEffect(() => {
    if (authUser && showAuth && !isGoogleUser) {
      onDone();
    }
  }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentStep === STEPS.SPLASH) {
      const t = setTimeout(() => goToStep(STEPS.WELCOME), 2000);
      return () => clearTimeout(t);
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === STEPS.STYLES_LOADING) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonPulse, { toValue: 0.8, duration: 600, useNativeDriver: true }),
          Animated.timing(skeletonPulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      const t = setTimeout(() => goToStep(STEPS.HAIR_STYLES), 1200);
      return () => { clearTimeout(t); loop.stop(); };
    }
  }, [currentStep]);

  // Creates the account (or, for Google users, confirms one already exists),
  // then lets the user into the app immediately — everything after that
  // (avatar, hair profile, stylist fields, preferences) finishes in the
  // background, unblocked, with no visible loading screen.
  const handleSignup = async () => {
    if (signupInProgress.current) return;
    signupInProgress.current = true;
    const username = formData.username.trim().toLowerCase();
    let userId;

    try {
      if (isGoogleUser) {
        // Already authenticated via Google — skip sign-up, just save onboarding data
        userId = authUser?.id;
        if (!userId) throw new Error('Missing user id for Google sign-in');
      } else {
        const { user, error } = await signUp(
          formData.email.trim(),
          formData.password,
          {
            name: `${formData.firstName} ${formData.lastName}`.trim(),
            username,
            location: formData.location,
            userType: formData.userType,
            selectedStyles: formData.selectedStyles,
            stylistSpecialties: formData.stylistSpecialties,
            stylistWorkType: formData.stylistWorkType,
            stylistExperience: formData.stylistExperience,
            businessName: formData.businessName,
            stylistAvailability: formData.stylistAvailability,
            services: services.filter(s => s.name.trim()),
          }
        );
        if (error) {
          console.error('[Signup] error:', JSON.stringify(error));
          signupInProgress.current = false;
          if (error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
            Alert.alert(
              'Account Already Exists',
              'An account with this email already exists. Please sign in from the home screen instead.',
              [{ text: 'OK', onPress: () => goToStep(STEPS.EMAIL) }]
            );
          } else {
            Alert.alert('Signup Failed', error.message || `${error.status || ''} ${error.statusText || error.code || 'Please try again'}`);
            goToStep(STEPS.EMAIL);
          }
          return;
        }
        userId = user?.id;
      }
    } catch (err) {
      signupInProgress.current = false;
      Alert.alert('Error', 'Something went wrong. Please try again.');
      goToStep(isGoogleUser ? STEPS.USERNAME : STEPS.EMAIL);
      return;
    }

    signupInProgress.current = false;
    // Account + session are live — hand off to the app now.
    onDone();

    try {
      if (userId) {
        await profileService.upsertProfile(userId, {
          full_name: `${formData.firstName} ${formData.lastName}`.trim(),
          username,
          location: formData.location,
          is_stylist: formData.userType === 'stylist',
        });
      }

      await Promise.allSettled([
        formData.profilePhoto && userId
          ? profileService.uploadAvatar(userId, formData.profilePhoto)
          : Promise.resolve(),
        formData.selectedStyles.length > 0 && userId
          ? profileService.updateProfile(userId, { style_preferences: formData.selectedStyles })
          : Promise.resolve(),
      ]);

      const prefs = {};
      if (formData.phone) prefs.phone = formData.phone;
      if (formData.usageGoals.length) prefs.usage_goals = formData.usageGoals;

      if (formData.userType === 'stylist' && userId) {
        const photoUrls = [];
        for (let i = 0; i < portfolioPhotos.length; i++) {
          const { url } = await profileService.uploadPortfolioPhoto(userId, portfolioPhotos[i], i);
          if (url) photoUrls.push(url);
        }
        let credentialsPhotoUrl = null;
        if (formData.credentialsPhoto) {
          const { url } = await profileService.uploadCredentialsPhoto(userId, formData.credentialsPhoto);
          credentialsPhotoUrl = url;
        }
        await stylistService.registerAsStylist(userId, {
          specialties: formData.stylistSpecialties,
          portfolioPhotos: [...photoUrls, ...selectedInstagramPhotos],
        });
        if (formData.businessName)      prefs.business_name = formData.businessName;
        if (formData.stylistWorkType)   prefs.work_type = formData.stylistWorkType;
        if (formData.stylistExperience) prefs.experience = formData.stylistExperience;
        if (formData.bookingLink)       prefs.booking_link = formData.bookingLink;
        const social = Object.fromEntries(Object.entries(formData.socialLinks).filter(([, v]) => v?.trim()));
        if (Object.keys(social).length) prefs.social_links = social;
        if (credentialsPhotoUrl)        prefs.credentials_photo_url = credentialsPhotoUrl;

        // Create CRWN posts for each selected Instagram photo
        if (selectedInstagramPhotos.length > 0) {
          const token = getAuthToken();
          if (token) {
            await fetch(`${AUTH_URL}/api/import-instagram-posts`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                posts: selectedInstagramPhotos.map(url => {
                  const original = instagramPhotos.find(p => p.url === url);
                  return { url, description: instagramCaptionEdits[url] ?? original?.caption ?? '' };
                }),
                businessName: formData.businessName || undefined,
              }),
            }).catch(e => console.warn('[import-instagram]', e.message));
          }
        }
      }

      if (Object.keys(prefs).length > 0 && userId) {
        await profileService.updateProfile(userId, { preferences: prefs });
      }
    } catch (err) {
      console.error('[Signup] background profile finalize failed:', err);
    }
  };

  const goToStep = (step) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setCurrentStep(step);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const handleUsernameNext = async () => {
    if (!isUsernameValid(formData.username)) return;
    setCheckingUsername(true);
    const { available } = await profileService.checkUsernameAvailable(formData.username);
    setCheckingUsername(false);
    if (!available) {
      setUsernameAvailError('That username is already taken. Please choose another.');
      return;
    }
    setUsernameAvailError('');
    goNext();
  };

  const goNext = () => {
    const importIdx = IMPORT_STEP_ORDER.indexOf(currentStep);
    if (importIdx !== -1) {
      goToStep(importIdx < IMPORT_STEP_ORDER.length - 1
        ? IMPORT_STEP_ORDER[importIdx + 1]
        : STEPS.ENDING_BUFFER);
      return;
    }
    const stylistIdx = STYLIST_STEP_ORDER.indexOf(currentStep);
    if (stylistIdx !== -1) {
      goToStep(stylistIdx < STYLIST_STEP_ORDER.length - 1
        ? STYLIST_STEP_ORDER[stylistIdx + 1]
        : STEPS.ENDING_BUFFER);
      return;
    }
    switch (currentStep) {
      case STEPS.USER_TYPE:
        goToStep(formData.userType === 'stylist' ? IMPORT_STEP_ORDER[0] : STEPS.USAGE_GOALS);
        break;
      case STEPS.STYLIST_BUFFER: goToStep(STYLIST_STEP_ORDER[0]); break;
      case STEPS.USAGE_GOALS: goToStep(STEPS.STYLES_LOADING); break;
      case STEPS.HAIR_STYLES: goToStep(STEPS.ENDING_BUFFER); break;
      case STEPS.ENDING_BUFFER: handleSignup(); break;
      default: {
        const idx = BASE_STEP_ORDER.indexOf(currentStep);
        if (idx !== -1 && idx < BASE_STEP_ORDER.length - 1) goToStep(BASE_STEP_ORDER[idx + 1]);
      }
    }
  };

  const goBack = () => {
    // Google users skipped EMAIL and PHONE_VERIFY — jump back to WELCOME
    if (isGoogleUser && currentStep === STEPS.USERNAME) {
      goToStep(STEPS.WELCOME);
      return;
    }
    const importIdx = IMPORT_STEP_ORDER.indexOf(currentStep);
    if (importIdx !== -1) {
      goToStep(importIdx > 0 ? IMPORT_STEP_ORDER[importIdx - 1] : STEPS.USER_TYPE);
      return;
    }
    const stylistIdx = STYLIST_STEP_ORDER.indexOf(currentStep);
    if (stylistIdx !== -1) {
      goToStep(stylistIdx > 0 ? STYLIST_STEP_ORDER[stylistIdx - 1] : STEPS.USER_TYPE);
      return;
    }
    switch (currentStep) {
      case STEPS.USAGE_GOALS: goToStep(STEPS.USER_TYPE); break;
      case STEPS.HAIR_STYLES: goToStep(STEPS.USAGE_GOALS); break;
      case STEPS.ENDING_BUFFER:
        goToStep(formData.userType === 'stylist'
          ? (stylistPath === 'import' ? STEPS.STYLIST_REVIEW : STYLIST_STEP_ORDER[STYLIST_STEP_ORDER.length - 1])
          : STEPS.HAIR_STYLES);
        break;
      default: {
        const idx = BASE_STEP_ORDER.indexOf(currentStep);
        if (idx > 0) goToStep(BASE_STEP_ORDER[idx - 1]);
      }
    }
  };

  const update = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const toggleStyle = (style) => {
    setFormData(prev => ({
      ...prev,
      selectedStyles: prev.selectedStyles.includes(style)
        ? prev.selectedStyles.filter(s => s !== style)
        : [...prev.selectedStyles, style],
    }));
  };

  const toggleUsageGoal = (goal) => {
    setFormData(prev => ({
      ...prev,
      usageGoals: prev.usageGoals.includes(goal)
        ? prev.usageGoals.filter(g => g !== goal)
        : [...prev.usageGoals, goal],
    }));
  };

  const toggleStylistSpecialty = (specialty) => {
    setFormData(prev => ({
      ...prev,
      stylistSpecialties: prev.stylistSpecialties.includes(specialty)
        ? prev.stylistSpecialties.filter(s => s !== specialty)
        : [...prev.stylistSpecialties, specialty],
    }));
  };

  const updateSocialLink = (key, value) =>
    setFormData(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: value } }));

  const addService = () => setServices(prev => [...prev, { name: '', price: '' }]);
  const updateService = (idx, field, value) =>
    setServices(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  const removeService = (idx) => setServices(prev => prev.filter((_, i) => i !== idx));

  const pickPortfolioPhoto = async () => {
    if (portfolioPhotos.length >= 6) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setPortfolioPhotos(prev => [...prev, result.assets[0].uri].slice(0, 6));
  };

  const toggleFollowCreator = (id) => {
    setFormData(prev => ({
      ...prev,
      followedCreators: prev.followedCreators.includes(id)
        ? prev.followedCreators.filter(c => c !== id)
        : [...prev.followedCreators, id],
    }));
  };

  const toggleFollowStylist = (id) => {
    setFormData(prev => ({
      ...prev,
      followedStylists: prev.followedStylists.includes(id)
        ? prev.followedStylists.filter(s => s !== id)
        : [...prev.followedStylists, id],
    }));
  };

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) update('profilePhoto', result.assets[0].uri);
  };

  const pickCredentialsPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) update('credentialsPhoto', result.assets[0].uri);
  };

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const PW_RULES = [
    { key: 'length',    label: 'At least 8 characters',   test: p => p.length >= 8 },
    { key: 'uppercase', label: 'One uppercase letter',     test: p => /[A-Z]/.test(p) },
    { key: 'lowercase', label: 'One lowercase letter',     test: p => /[a-z]/.test(p) },
    { key: 'number',    label: 'One number',               test: p => /[0-9]/.test(p) },
    { key: 'special',   label: 'One special character',    test: p => /[^A-Za-z0-9]/.test(p) },
  ];
  const isPwStrong = (p) => PW_RULES.every(r => r.test(p));
  const isEmailStepValid = () =>
    isValidEmail(formData.email) &&
    isPwStrong(formData.password) &&
    formData.password === formData.confirmPassword;
  const isUsernameValid = (u) => /^[a-z0-9_.]{3,20}$/.test(u);

  // ── Progress bar ────────────────────────────────────────────────────────────

  const renderProgress = () => {
    const group = PROGRESS_GROUPS.find(g => g.includes(currentStep));
    if (!group) return null;
    const progressIndex = group.indexOf(currentStep);
    return (
      <View style={styles.progressContainer}>
        {group.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i < progressIndex && styles.progressDotCompleted,
              i === progressIndex && styles.progressDotCurrent,
            ]}
          />
        ))}
      </View>
    );
  };

  // ── Back button ─────────────────────────────────────────────────────────────

  const renderBack = () => {
    const noBack = [STEPS.SPLASH, STEPS.WELCOME, STEPS.STYLES_LOADING];
    if (noBack.includes(currentStep)) return null;
    return (
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
    );
  };

  // ── Step renderers ──────────────────────────────────────────────────────────

  const renderSplash = () => (
    <GradientScreen>
      <View style={styles.splashContent}>
        <Text style={styles.splashLogo}>crwn.</Text>
        <Text style={styles.splashTagline}>Every crown tells a story.</Text>
      </View>
    </GradientScreen>
  );

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        Alert.alert('Google Sign In Failed', result.error.message || 'Please try again.');
        return;
      }

      if (!result.isNewUser) {
        // Returning user — already has a CRWN account, skip onboarding
        onDone();
        return;
      }

      // New user — pre-fill wizard with Google data and continue onboarding
      const googleUser = result.data?.user || authUser;
      if (googleUser) {
        const nameParts = (googleUser.name || '').trim().split(' ');
        setFormData(prev => ({
          ...prev,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          email: googleUser.email || '',
          username: (googleUser.email?.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        }));
      }
      setIsGoogleUser(true);
      goToStep(STEPS.USERNAME);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const renderWelcome = () => (
    <GradientScreen>
      <View style={styles.welcomeContent}>
        <Text style={styles.welcomeLogo}>crwn.</Text>
        <Text style={styles.welcomeTagline}>Every crown tells a story.</Text>
      </View>
      <View style={styles.welcomeButtons}>
        <TouchableOpacity style={styles.createAccountButton} onPress={goNext}>
          <Text style={styles.createAccountText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.googleButton, googleLoading && { opacity: 0.6 }]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          activeOpacity={0.85}
        >
          {googleLoading ? (
            <ActivityIndicator color="#5D3A1A" />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#5D3A1A" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowAuth(true)}>
          <Text style={styles.signInText}>
            Have an account? <Text style={styles.signInLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </GradientScreen>
  );

  const renderEmail = () => (
    <WhiteScreen scrollable footer={<ContinueButton onPress={goNext} disabled={!formData.firstName.trim() || !isEmailStepValid()} />}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Create your account</Text>
      <Text style={styles.questionSubtitle}>Tell us a bit about yourself to get started.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>First name</Text>
        <TextInput
          style={styles.input}
          value={formData.firstName}
          onChangeText={t => update('firstName', t)}
          placeholder="Enter your first name"
          placeholderTextColor="#999"
          autoCapitalize="words"
          textContentType="givenName"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Last name</Text>
        <TextInput
          style={styles.input}
          value={formData.lastName}
          onChangeText={t => update('lastName', t)}
          placeholder="Enter your last name"
          placeholderTextColor="#999"
          autoCapitalize="words"
          textContentType="familyName"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={t => update('email', t.toLowerCase())}
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
            onChangeText={t => update('password', t)}
            placeholder="Create a strong password"
            placeholderTextColor="#999"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(p => !p)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#999" />
          </TouchableOpacity>
        </View>
        {formData.password.length > 0 && (
          <View style={styles.pwRulesWrap}>
            <Text style={styles.pwRulesTitle}>Must contain:</Text>
            {PW_RULES.map(rule => {
              const met = rule.test(formData.password);
              return (
                <View key={rule.key} style={styles.pwRuleRow}>
                  <Ionicons
                    name={met ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={met ? '#3B7A3B' : '#AAAAAA'}
                  />
                  <Text style={[styles.pwRuleText, met && styles.pwRuleTextMet]}>
                    {rule.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          value={formData.confirmPassword}
          onChangeText={t => update('confirmPassword', t)}
          placeholder="Re-enter your password"
          placeholderTextColor="#999"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword && (
          <Text style={styles.errorText}>Passwords don't match</Text>
        )}
      </View>

    </WhiteScreen>
  );

  const renderPhoneVerify = () => {
    const phoneDigits = formData.phone.replace(/[^0-9]/g, '');

    if (phoneStage === 'code') {
      return (
        <WhiteScreen scrollable footer={<ContinueButton onPress={goNext} disabled={phoneCode.length !== 6} />}>
          <TouchableOpacity style={styles.backButton} onPress={() => setPhoneStage('enter')}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          {renderProgress()}
          <Text style={styles.questionTitle}>Enter your code</Text>
          <Text style={styles.questionSubtitle}>We sent a 6-digit code to {formData.phone}.</Text>

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.otpInput}
              value={phoneCode}
              onChangeText={t => setPhoneCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor="#C4B5A0"
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
          </View>
        </WhiteScreen>
      );
    }

    return (
      <WhiteScreen scrollable footer={<>
        <ContinueButton onPress={() => setPhoneStage('code')} disabled={phoneDigits.length < 7} label="Send code" />
        <TouchableOpacity style={styles.skipLink} onPress={goNext}>
          <Text style={styles.skipLinkText}>Skip for now</Text>
        </TouchableOpacity>
      </>}>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>Verify your number</Text>
        <Text style={styles.questionSubtitle}>We'll send a code to confirm it's really you.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={t => update('phone', t)}
            placeholder="(555) 555-5555"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />
        </View>
      </WhiteScreen>
    );
  };

  const renderUsername = () => (
    <WhiteScreen scrollable footer={<ContinueButton onPress={handleUsernameNext} disabled={!isUsernameValid(formData.username) || checkingUsername} loading={checkingUsername} />}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Choose your username</Text>
      <Text style={styles.questionSubtitle}>Your username will be visible to the CRWN community.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Username</Text>
        <View style={styles.usernameInputContainer}>
          <Text style={styles.usernameAt}>@</Text>
          <TextInput
            style={styles.usernameInput}
            value={formData.username}
            onChangeText={t => { update('username', t.toLowerCase().replace(/[^a-z0-9_.]/g, '')); setUsernameAvailError(''); }}
            placeholder="yourname"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
        </View>
        {formData.username.length > 0 && !isUsernameValid(formData.username) && (
          <Text style={styles.errorText}>Username must be 3-20 characters (letters, numbers, _ or .)</Text>
        )}
        {!!usernameAvailError && (
          <Text style={styles.errorText}>{usernameAvailError}</Text>
        )}
      </View>
    </WhiteScreen>
  );

  const renderName = () => (
    <WhiteScreen>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>What's your name?</Text>
      <Text style={styles.questionSubtitle}>This helps us personalize your experience.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>First name</Text>
        <TextInput
          style={styles.input}
          value={formData.firstName}
          onChangeText={t => update('firstName', t)}
          placeholder="Enter your first name"
          placeholderTextColor="#999"
          autoCapitalize="words"
          textContentType="givenName"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Last name</Text>
        <TextInput
          style={styles.input}
          value={formData.lastName}
          onChangeText={t => update('lastName', t)}
          placeholder="Enter your last name"
          placeholderTextColor="#999"
          autoCapitalize="words"
          textContentType="familyName"
        />
      </View>

      <ContinueButton onPress={goNext} disabled={!formData.firstName} />
    </WhiteScreen>
  );

  const renderLocation = () => {
    const stateObj = US_STATES.find(s => s.abbr === locStateAbbr);
    const filteredStates = pickerSearch
      ? US_STATES.filter(s => s.name.toLowerCase().includes(pickerSearch.toLowerCase()) || s.abbr.toLowerCase().includes(pickerSearch.toLowerCase()))
      : US_STATES;

    const selectState = (abbr) => {
      setLocStateAbbr(abbr);
      setLocCity('');
      update('location', '');
      setPickerSearch('');
      setShowStatePicker(false);
    };

    const handleCityChange = (text) => {
      setLocCity(text);
      update('location', text && locStateAbbr ? `${text}, ${locStateAbbr}` : '');
    };

    return (
      <WhiteScreen>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>Where are you located?</Text>
        <Text style={styles.questionSubtitle}>We'll show you stylists and content near you.</Text>

        {/* State picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>State</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => { setPickerSearch(''); setShowStatePicker(true); }}
          >
            <Text style={[styles.pickerButtonText, !stateObj && styles.pickerPlaceholder]}>
              {stateObj ? `${stateObj.name} (${stateObj.abbr})` : 'Select a state'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#999" />
          </TouchableOpacity>
        </View>

        {/* City — free text, shown after state selected */}
        {locStateAbbr ? (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.input}
              value={locCity}
              onChangeText={handleCityChange}
              placeholder="Enter your city"
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
          </View>
        ) : null}

        <ContinueButton onPress={goNext} disabled={!formData.location} />

        {/* State picker modal */}
        <Modal visible={showStatePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStatePicker(false)}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerSearchWrap}>
              <Ionicons name="search" size={16} color="#999" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search states…"
                placeholderTextColor="#999"
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={item => item.abbr}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, item.abbr === locStateAbbr && styles.pickerItemSelected]}
                  onPress={() => selectState(item.abbr)}
                >
                  <Text style={[styles.pickerItemText, item.abbr === locStateAbbr && styles.pickerItemTextSelected]}>
                    {item.name}
                  </Text>
                  <Text style={styles.pickerItemAbbr}>{item.abbr}</Text>
                  {item.abbr === locStateAbbr && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.pickerSep} />}
            />
          </View>
        </Modal>
      </WhiteScreen>
    );
  };

  const renderProfilePhoto = () => (
    <WhiteScreen>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Add a profile photo</Text>
      <Text style={styles.questionSubtitle}>Help others recognize you in the community.</Text>

      <View style={styles.photoPickerCenter}>
        <TouchableOpacity style={styles.avatarPickerWrap} onPress={pickProfilePhoto} activeOpacity={0.8}>
          {formData.profilePhoto ? (
            <Image source={{ uri: formData.profilePhoto }} style={styles.avatarPreview} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color="#C4B5A0" />
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.choosePhotoBtn} onPress={pickProfilePhoto}>
          <Text style={styles.choosePhotoBtnText}>Choose Photo</Text>
        </TouchableOpacity>
      </View>

      <ContinueButton onPress={goNext} disabled={false} />
      <TouchableOpacity style={styles.skipLink} onPress={goNext}>
        <Text style={styles.skipLinkText}>Skip for now</Text>
      </TouchableOpacity>
    </WhiteScreen>
  );

  const renderUserType = () => (
    <WhiteScreen>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>What brings you to CRWN?</Text>
      <Text style={styles.questionSubtitle}>Choose the experience that's made for you.</Text>

      <View style={styles.userTypeFork}>
        <TouchableOpacity
          style={[styles.userTypeCard, formData.userType === 'explorer' && styles.userTypeCardSelected]}
          onPress={() => update('userType', 'explorer')}
          activeOpacity={0.85}
        >
          <Text style={styles.userTypeCardTitle}>I'm here for my hair</Text>
          <Text style={styles.userTypeCardDesc}>Discover styles and textured hair professionals</Text>
          {formData.userType === 'explorer' && (
            <View style={styles.userTypeCheckmark}>
              <Ionicons name="checkmark-circle" size={22} color={colors.forest} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.userTypeCard, formData.userType === 'stylist' && styles.userTypeCardSelected]}
          onPress={() => update('userType', 'stylist')}
          activeOpacity={0.85}
        >
          <Text style={styles.userTypeCardTitle}>I'm a hair professional</Text>
          <Text style={styles.userTypeCardDesc}>Showcase your work, grow your clientele, and connect with the community.</Text>
          {formData.userType === 'stylist' && (
            <View style={styles.userTypeCheckmark}>
              <Ionicons name="checkmark-circle" size={22} color={colors.forest} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ContinueButton onPress={goNext} disabled={!formData.userType} />
    </WhiteScreen>
  );

  // Shown once, immediately after picking "I'm a hair professional" — a beat
  // before the stylist-specific question flow starts. Not part of
  // STYLIST_STEP_ORDER (no progress dots, no back button), same as ENDING_BUFFER.
  const renderStylistBuffer = () => (
    <View style={styles.completeScreen}>
      <AnimatedGradientBackground />

      <View style={styles.completeTextBlock}>
        <Text style={styles.stylistBufferEyebrow}>A FEW MORE QUESTIONS TO</Text>
        <Text style={styles.completeTitle}>
          <Text style={styles.completeTitleDark}>complete</Text>
          {'\n'}
          <Text style={styles.completeTitleMaroon}>service provider</Text>
          {'\n'}
          <Text style={styles.completeTitleItalic}>onboarding.</Text>
        </Text>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.completeButtonWrap}>
        <TouchableOpacity style={styles.completeContinueBtn} onPress={goNext}>
          <Text style={styles.completeContinueBtnText}>Continue</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );

  const stylistSkipFooter = (disabled = false) => (
    <>
      <TouchableOpacity style={styles.skipLink} onPress={goNext}>
        <Text style={styles.skipLinkText}>Skip for now</Text>
      </TouchableOpacity>
      <ContinueButton onPress={goNext} disabled={disabled} />
    </>
  );

  const renderStylistWorkType = () => (
    <WhiteScreen scrollable footer={<ContinueButton onPress={goNext} disabled={!formData.stylistWorkType} />}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>How do you work?</Text>
      <Text style={styles.questionSubtitle}>Tell us about your setup so clients know what to expect.</Text>
      <View style={styles.optionsContainer}>
        {['Independent / Freelance', 'Salon-based', 'Mobile stylist (I come to you)', 'Suite / Studio rental'].map(opt => {
          const sel = formData.stylistWorkType === opt;
          return (
            <TouchableOpacity key={opt} style={[styles.optionButton, sel && styles.optionButtonSelected]} onPress={() => update('stylistWorkType', opt)}>
              <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WhiteScreen>
  );

  const renderStylistExperience = () => (
    <WhiteScreen scrollable footer={stylistSkipFooter()}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>How long have you been doing this?</Text>
      <Text style={styles.questionSubtitle}>Your experience helps clients find the right fit.</Text>
      <View style={styles.optionsContainer}>
        {['Just starting out (0–2 years)', 'Getting established (3–5 years)', 'Seasoned stylist (6–10 years)', 'Industry veteran (10+ years)'].map(opt => {
          const sel = formData.stylistExperience === opt;
          return (
            <TouchableOpacity key={opt} style={[styles.optionButton, sel && styles.optionButtonSelected]} onPress={() => update('stylistExperience', opt)}>
              <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WhiteScreen>
  );

  const renderStylistSpecialties = () => (
    <WhiteScreen
      scrollable
      footer={stylistSkipFooter()}
      header={<>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>What do you specialize in?</Text>
        <Text style={styles.questionSubtitle}>Select the styles and techniques that define your work.</Text>
      </>}
    >
      <View style={styles.optionsContainer}>
        {STYLIST_SPECIALTY_OPTIONS.map(opt => {
          const sel = formData.stylistSpecialties.includes(opt);
          return (
            <TouchableOpacity key={opt} style={[styles.optionButton, sel && styles.optionButtonSelected]} onPress={() => toggleStylistSpecialty(opt)}>
              <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WhiteScreen>
  );

  const renderStylistBusinessName = () => (
    <WhiteScreen scrollable footer={<ContinueButton onPress={goNext} disabled={!formData.businessName.trim()} />}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>What is your business called?</Text>
      <Text style={styles.questionSubtitle}>Add your salon or brand name so clients can find and recognize you.</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.businessName}
          onChangeText={t => update('businessName', t)}
          placeholder="@"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
      </View>
    </WhiteScreen>
  );

  const renderStylistCredentials = () => (
    <WhiteScreen scrollable footer={stylistSkipFooter()}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Show your professional credentials</Text>
      <Text style={styles.questionSubtitle}>Upload a photo of your license, certification, or training credential. This helps build trust with clients.</Text>

      <TouchableOpacity
        style={[styles.credentialsUploadBox, formData.credentialsPhoto && styles.credentialsUploadBoxFilled]}
        onPress={pickCredentialsPhoto}
        activeOpacity={0.8}
      >
        {formData.credentialsPhoto ? (
          <Image source={{ uri: formData.credentialsPhoto }} style={styles.credentialsPreview} />
        ) : (
          <>
            <View style={styles.portfolioUploadIcon}>
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </View>
            <Text style={styles.portfolioUploadTitle}>Tap to upload a photo</Text>
            <Text style={styles.portfolioUploadSub}>License, certification, or training credential</Text>
          </>
        )}
      </TouchableOpacity>
    </WhiteScreen>
  );

  const renderStylistBookingLink = () => (
    <WhiteScreen scrollable footer={stylistSkipFooter()}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Add your booking link</Text>
      <Text style={styles.questionSubtitle}>Share the link clients use to book with you (Calendly, Vagaro, Instagram, etc.).</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Booking link</Text>
        <TextInput
          style={styles.input}
          value={formData.bookingLink}
          onChangeText={t => update('bookingLink', t)}
          placeholder="https://"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>
    </WhiteScreen>
  );

  const renderStylistSocialLinks = () => (
    <WhiteScreen scrollable footer={stylistSkipFooter()}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Connect your social media</Text>
      <Text style={styles.questionSubtitle}>Add your handles so clients can find your work across platforms.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Instagram</Text>
        <View style={styles.iconInputContainer}>
          <Ionicons name="logo-instagram" size={20} color="#999" style={styles.iconInputIcon} />
          <TextInput
            style={styles.iconInput}
            value={formData.socialLinks.instagram}
            onChangeText={t => updateSocialLink('instagram', t)}
            placeholder="@yourusername"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>TikTok</Text>
        <View style={styles.iconInputContainer}>
          <Ionicons name="logo-tiktok" size={20} color="#999" style={styles.iconInputIcon} />
          <TextInput
            style={styles.iconInput}
            value={formData.socialLinks.tiktok}
            onChangeText={t => updateSocialLink('tiktok', t)}
            placeholder="@yourusername"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Other link</Text>
        <View style={styles.iconInputContainer}>
          <Ionicons name="link" size={20} color="#999" style={styles.iconInputIcon} />
          <TextInput
            style={styles.iconInput}
            value={formData.socialLinks.other}
            onChangeText={t => updateSocialLink('other', t)}
            placeholder="https://"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      </View>
    </WhiteScreen>
  );

  const renderStylistAvailability = () => (
    <WhiteScreen scrollable footer={stylistSkipFooter()}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Are you accepting new clients?</Text>
      <Text style={styles.questionSubtitle}>Set your current availability so your CRWN profile stays accurate.</Text>
      <View style={styles.optionsContainer}>
        {['Yes, accepting new clients', 'Accepting clients by referral only', 'Currently on a waitlist', 'Not accepting new clients right now'].map(opt => {
          const sel = formData.stylistAvailability === opt;
          return (
            <TouchableOpacity key={opt} style={[styles.optionButton, sel && styles.optionButtonSelected]} onPress={() => update('stylistAvailability', opt)}>
              <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WhiteScreen>
  );

  const renderStylistBooking = () => (
    <WhiteScreen scrollable footer={stylistSkipFooter()}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Your services & pricing</Text>
      <Text style={styles.questionSubtitle}>Add your styles and what you charge so clients know what to expect.</Text>
      {services.map((service, idx) => (
        <View key={idx} style={styles.serviceRow}>
          <TextInput
            style={styles.serviceNameInput}
            value={service.name}
            onChangeText={t => updateService(idx, 'name', t)}
            placeholder="e.g. Small knotless braids"
            placeholderTextColor="#999"
          />
          <View style={styles.servicePriceWrap}>
            <Text style={styles.serviceDollar}>$</Text>
            <TextInput
              style={styles.servicePriceInput}
              value={service.price}
              onChangeText={t => updateService(idx, 'price', t.replace(/[^0-9]/g, ''))}
              placeholder="250"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
          {services.length > 1 && (
            <TouchableOpacity onPress={() => removeService(idx)} style={styles.serviceRemove}>
              <Ionicons name="close" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={styles.addServiceBtn} onPress={addService}>
        <Ionicons name="add" size={20} color={colors.forest} />
        <Text style={styles.addServiceText}>Add service</Text>
      </TouchableOpacity>
    </WhiteScreen>
  );

  const renderStylistPortfolio = () => (
    <WhiteScreen scrollable footer={stylistSkipFooter()}>
      {renderBack()}
      {renderProgress()}
      <Text style={styles.questionTitle}>Show them what you can do.</Text>
      <Text style={styles.questionSubtitle}>Upload photos of your work — this is your first impression on CRWN.</Text>
      {portfolioPhotos.length === 0 ? (
        <TouchableOpacity style={styles.portfolioUploadBox} onPress={pickPortfolioPhoto} activeOpacity={0.8}>
          <View style={styles.portfolioUploadIcon}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </View>
          <Text style={styles.portfolioUploadTitle}>Tap to upload photos</Text>
          <Text style={styles.portfolioUploadSub}>You can add up to 6 photos</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.portfolioGrid}>
          {portfolioPhotos.map((uri, idx) => (
            <View key={idx} style={styles.portfolioThumbWrap}>
              <Image source={{ uri }} style={styles.portfolioThumb} />
              <TouchableOpacity style={styles.portfolioThumbRemove} onPress={() => setPortfolioPhotos(prev => prev.filter((_, i) => i !== idx))}>
                <Ionicons name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {portfolioPhotos.length < 6 && (
            <TouchableOpacity style={styles.portfolioAddMore} onPress={pickPortfolioPhoto}>
              <Ionicons name="add" size={28} color="#C4B5A0" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </WhiteScreen>
  );

  const renderStylistImport = () => {
    const canScrape = importUrl.trim().length > 5;

    const handleScrape = async () => {
      setScrapeLoading(true);
      setScrapeError('');
      try {
        const res = await fetch(`${AUTH_URL}/api/scrape-booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: importUrl.trim() }),
        });
        const data = await res.json();
        if (data.error && !data.businessName) {
          setScrapeError('Could not read that page. Try a different link or set up manually.');
        } else {
          setImportedData(data);
        }
      } catch {
        setScrapeError('Could not reach that page. Check the link and try again.');
      } finally {
        setScrapeLoading(false);
      }
    };

    return (
      <WhiteScreen scrollable footer={importedData
        ? <ContinueButton onPress={goNext} label="Continue" />
        : null
      }>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>Import your services</Text>
        <Text style={styles.questionSubtitle}>
          Paste your StyleSeat, Vagaro, Square, or Calendly link and we'll pull in your services automatically.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Booking link</Text>
          <TextInput
            style={styles.input}
            value={importUrl}
            onChangeText={setImportUrl}
            placeholder="https://styleseat.com/..."
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        <TouchableOpacity
          style={[styles.importScrapeBtn, (!canScrape || scrapeLoading) && { opacity: 0.4 }]}
          onPress={handleScrape}
          disabled={!canScrape || scrapeLoading}
        >
          {scrapeLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.importScrapeBtnText}>Import Services</Text>}
        </TouchableOpacity>

        {!!scrapeError && <Text style={[styles.errorText, { marginTop: 8 }]}>{scrapeError}</Text>}

        {importedData && (
          <View style={styles.importResultCard}>
            {!!importedData.businessName && (
              <Text style={styles.importResultBiz}>{importedData.businessName}</Text>
            )}
            {importedData.services?.length > 0 ? (
              <>
                <Text style={styles.importResultLabel}>
                  {importedData.services.length} service{importedData.services.length !== 1 ? 's' : ''} found
                </Text>
                {importedData.services.slice(0, 5).map((s, i) => (
                  <View key={i} style={styles.importResultRow}>
                    <Text style={styles.importResultServiceName}>{s.name}</Text>
                    {!!s.price && <Text style={styles.importResultPrice}>{s.price}</Text>}
                  </View>
                ))}
                {importedData.services.length > 5 && (
                  <Text style={styles.importResultMore}>+ {importedData.services.length - 5} more</Text>
                )}
              </>
            ) : (
              <Text style={styles.importResultLabel}>No services found — you can add them manually after setup.</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.skipLink}
          onPress={() => { setStylistPath('manual'); goToStep(STYLIST_STEP_ORDER[0]); }}
        >
          <Text style={styles.skipLinkText}>Set up manually instead</Text>
        </TouchableOpacity>
      </WhiteScreen>
    );
  };

  const renderStylistInstagram = () => {
    const handleConnect = async () => {
      setInstagramLoading(true);
      try {
        const res = await fetch(`${AUTH_URL}/api/instagram/auth-url`);
        const { url } = await res.json();
        const result = await WebBrowser.openAuthSessionAsync(url, 'crwn://instagram-callback');
        if (result.type === 'success') {
          const urlObj = new URL(result.url);
          const photosStr = urlObj.searchParams.get('photos');
          if (photosStr) {
            const photos = JSON.parse(decodeURIComponent(photosStr)); // [{ url, caption }]
            setInstagramPhotos(photos);
            setSelectedInstagramPhotos(photos.map(p => p.url)); // auto-select all
          }
        }
      } catch (e) {
        console.warn('[Instagram OAuth]', e.message);
      } finally {
        setInstagramLoading(false);
      }
    };

    return (
      <WhiteScreen scrollable footer={
        <ContinueButton onPress={goNext} label={instagramPhotos.length > 0 ? 'Continue' : 'Skip'} />
      }>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>Add portfolio photos</Text>
        <Text style={styles.questionSubtitle}>
          Connect Instagram to pull your best work in automatically. You can also add photos manually after setup.
        </Text>

        {instagramPhotos.length > 0 ? (
          <>
            <Text style={styles.importResultLabel}>
              {selectedInstagramPhotos.length} of {instagramPhotos.length} selected — tap to toggle
            </Text>
            <View style={styles.importPhotoGrid}>
              {instagramPhotos.map((item, i) => {
                const selected = selectedInstagramPhotos.includes(item.url);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setSelectedInstagramPhotos(prev =>
                      prev.includes(item.url) ? prev.filter(u => u !== item.url) : [...prev, item.url]
                    )}
                    activeOpacity={0.8}
                    style={{ position: 'relative' }}
                  >
                    <Image
                      source={{ uri: item.url }}
                      style={[styles.importPhotoThumb, !selected && { opacity: 0.35 }]}
                    />
                    {selected && (
                      <View style={styles.igPhotoCheck}>
                        <Ionicons name="checkmark-circle" size={22} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.importConnectBtn, instagramLoading && { opacity: 0.6 }]}
            onPress={handleConnect}
            disabled={instagramLoading}
          >
            {instagramLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="logo-instagram" size={22} color="#fff" />
                <Text style={styles.importConnectBtnText}>Connect Instagram</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.skipLink} onPress={goNext}>
          <Text style={styles.skipLinkText}>Skip for now</Text>
        </TouchableOpacity>
      </WhiteScreen>
    );
  };

  const renderStylistReview = () => {
    const handleConfirm = () => {
      if (importedData) {
        if (importedData.businessName) update('businessName', importedData.businessName);
        if (importedData.services?.length > 0) {
          setServices(importedData.services.map(s => ({
            name: s.name,
            price: s.price ? s.price.replace(/[^0-9.]/g, '') : '',
          })));
        }
      }
      goToStep(STEPS.ENDING_BUFFER);
    };

    const hasAnything = importedData?.businessName || importedData?.services?.length || selectedInstagramPhotos.length;

    return (
      <WhiteScreen scrollable footer={
        <ContinueButton onPress={handleConfirm} label="Confirm & Continue" />
      }>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>Review your profile</Text>
        <Text style={styles.questionSubtitle}>
          Here's what we'll add to your CRWN profile. Everything can be edited later.
        </Text>

        {!hasAnything && (
          <View style={styles.reviewEmptyState}>
            <Ionicons name="information-circle-outline" size={40} color="#C4B5A0" />
            <Text style={styles.reviewEmptyText}>
              Nothing was imported. Tap confirm to continue and add your details from your profile settings.
            </Text>
          </View>
        )}

        {!!importedData?.businessName && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Business name</Text>
            <Text style={styles.reviewSectionValue}>{importedData.businessName}</Text>
          </View>
        )}

        {importedData?.services?.length > 0 && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>
              Services ({importedData.services.length})
            </Text>
            {importedData.services.map((s, i) => (
              <View key={i} style={styles.importResultRow}>
                <Text style={styles.importResultServiceName}>{s.name}</Text>
                {!!s.price && <Text style={styles.importResultPrice}>{s.price}</Text>}
              </View>
            ))}
          </View>
        )}

        {selectedInstagramPhotos.length > 0 && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>
              Posts to publish ({selectedInstagramPhotos.length})
            </Text>
            <Text style={styles.reviewPostHint}>Edit captions before publishing</Text>
            {selectedInstagramPhotos.map((url, i) => {
              const original = instagramPhotos.find(p => p.url === url);
              const caption = instagramCaptionEdits[url] ?? original?.caption ?? '';
              return (
                <View key={i} style={styles.reviewPostCard}>
                  <Image source={{ uri: url }} style={styles.reviewPostThumb} />
                  <TextInput
                    style={styles.reviewPostCaption}
                    value={caption}
                    onChangeText={text =>
                      setInstagramCaptionEdits(prev => ({ ...prev, [url]: text }))
                    }
                    placeholder="Add a caption..."
                    placeholderTextColor="#B0A090"
                    multiline
                  />
                </View>
              );
            })}
          </View>
        )}
      </WhiteScreen>
    );
  };

  const renderStylistFindCreators = () => {
    const leftCreators = MOCK_CREATORS.filter((_, i) => i % 2 === 0);
    const rightCreators = MOCK_CREATORS.filter((_, i) => i % 2 === 1);
    const renderCreatorCard = (creator) => {
      const followed = formData.followedCreators.includes(creator.id);
      return (
        <View key={creator.id} style={[styles.personCard, { height: creator.height }]}>
          <LinearGradient colors={creator.colors} style={StyleSheet.absoluteFill} />
          <View style={styles.personCardBottom}>
            <View style={styles.personCardHeader}>
              <View style={styles.personAvatar}>
                <Text style={styles.personAvatarText}>{creator.username[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personUsername}>{creator.username}</Text>
                <View style={styles.personTagChip}>
                  <Text style={styles.personTagText}>{creator.tag}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.followBtn, followed && styles.followBtnActive]}
              onPress={() => toggleFollowCreator(creator.id)}
            >
              <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
                {followed ? '✓ Following' : '+ Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };
    return (
      <WhiteScreen scrollable footer={stylistSkipFooter()}>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>Find creators to follow</Text>
        <Text style={styles.questionSubtitle}>Get inspired by the community you're joining.</Text>
        <View style={styles.masonryRow}>
          <View style={styles.masonryCol}>{leftCreators.map(renderCreatorCard)}</View>
          <View style={styles.masonryCol}>{rightCreators.map(renderCreatorCard)}</View>
        </View>
      </WhiteScreen>
    );
  };

  const renderUsageGoals = () => (
    <WhiteScreen scrollable footer={<ContinueButton onPress={goNext} disabled={false} />}>
      {renderBack()}
      <Text style={styles.questionTitle}>How do you want to use CRWN?</Text>
      <Text style={styles.questionSubtitle}>Select everything that applies, we'll personalize your experience around it.</Text>
      <View style={styles.optionsContainer}>
        {USAGE_GOAL_OPTIONS.map(opt => {
          const sel = formData.usageGoals.includes(opt);
          return (
            <TouchableOpacity key={opt} style={[styles.optionButton, sel && styles.optionButtonSelected]} onPress={() => toggleUsageGoal(opt)}>
              <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WhiteScreen>
  );

  const renderStylesLoading = () => {
    const placeholders = [220, 180, 200, 240, 190, 210].map((height, i) => ({ height, i }));
    const leftPlaceholders = placeholders.filter((_, i) => i % 2 === 0);
    const rightPlaceholders = placeholders.filter((_, i) => i % 2 === 1);
    const renderPlaceholderCard = ({ height, i }) => (
      <Animated.View key={i} style={[styles.skeletonCard, { height, opacity: skeletonPulse }]}>
        <LinearGradient
          colors={SKELETON_GRADIENTS[i % SKELETON_GRADIENTS.length]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.skeletonLabel} />
      </Animated.View>
    );

    return (
      <WhiteScreen scrollable>
        {renderProgress()}
        <Text style={styles.questionTitle}>What styles speak to you?</Text>
        {/* <Text style={styles.questionSubtitle}>Select all that apply — your feed will reflect your taste.</Text> */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterContent}
        >
          {STYLE_FILTER_CHIPS.map(f => (
            <View key={f} style={[styles.filterChip, f === 'Protective' && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, f === 'Protective' && styles.filterChipTextActive]}>{f}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.masonryRow}>
          <View style={styles.masonryCol}>{leftPlaceholders.map(renderPlaceholderCard)}</View>
          <View style={styles.masonryCol}>{rightPlaceholders.map(renderPlaceholderCard)}</View>
        </View>
      </WhiteScreen>
    );
  };

  const renderHairStyles = () => {
    const filteredLooks = HAIR_STYLES.filter(l => l.category === hairLookFilter);
    const leftLooks = filteredLooks.filter((_, i) => i % 2 === 0);
    const rightLooks = filteredLooks.filter((_, i) => i % 2 === 1);

    const renderLookCard = (look) => {
      const selected = formData.selectedStyles.includes(look.id);
      return (
        <View key={look.id} style={selected && styles.lookCardGlow}>
          <TouchableOpacity
            style={[styles.personCard, { height: look.height }]}
            onPress={() => toggleStyle(look.id)}
            activeOpacity={0.9}
          >
            <Image source={look.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(26,22,18,0.9)']}
              locations={[0, 1]}
              style={styles.lookCardGradient}
              pointerEvents="none"
            />
            {selected && (
              <View style={styles.lookCheckmark}>
                <Ionicons name="checkmark-circle" size={22} color={colors.white} />
              </View>
            )}
            <View style={styles.lookCardTag}>
              <Text style={styles.lookCardTagText}>{look.label}</Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <WhiteScreen
        scrollable
        header={<>
          {renderProgress()}
          <Text style={styles.questionTitle}>What styles speak to you?</Text>
          {/* <Text style={styles.questionSubtitle}>Select all that apply — your feed will reflect your taste.</Text> */}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterBar}
            contentContainerStyle={styles.filterContent}
          >
            {STYLE_FILTER_CHIPS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, hairLookFilter === f && styles.filterChipActive]}
                onPress={() => setHairLookFilter(f)}
              >
                <Text style={[styles.filterChipText, hairLookFilter === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>}
        footer={<>
          <ContinueButton onPress={goNext} disabled={formData.selectedStyles.length === 0} />
          <TouchableOpacity style={styles.skipLink} onPress={goNext}>
            <Text style={styles.skipLinkText}>Skip for now</Text>
          </TouchableOpacity>
        </>}
      >
        <View style={styles.masonryRow}>
          <View style={styles.masonryCol}>{leftLooks.map(renderLookCard)}</View>
          <View style={styles.masonryCol}>{rightLooks.map(renderLookCard)}</View>
        </View>
      </WhiteScreen>
    );
  };

  const renderCreators = () => {
    const leftCreators = MOCK_CREATORS.filter((_, i) => i % 2 === 0);
    const rightCreators = MOCK_CREATORS.filter((_, i) => i % 2 === 1);

    const renderCreatorCard = (creator) => {
      const followed = formData.followedCreators.includes(creator.id);
      const initial = creator.username[0].toUpperCase();
      return (
        <View key={creator.id} style={[styles.personCard, { height: creator.height }]}>
          <LinearGradient colors={creator.colors} style={StyleSheet.absoluteFill} />
          <View style={styles.personCardBottom}>
            <View style={styles.personCardHeader}>
              <View style={styles.personAvatar}>
                <Text style={styles.personAvatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personUsername}>{creator.username}</Text>
                <View style={styles.personTagChip}>
                  <Text style={styles.personTagText}>{creator.tag}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.followBtn, followed && styles.followBtnActive]}
              onPress={() => toggleFollowCreator(creator.id)}
            >
              <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
                {followed ? '✓ Following' : '+ Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };

    return (
      <WhiteScreen scrollable footer={<>
        <ContinueButton onPress={goNext} disabled={false} />
        <TouchableOpacity style={styles.skipLink} onPress={goNext}>
          <Text style={styles.skipLinkText}>Skip for now</Text>
        </TouchableOpacity>
      </>}>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>Creators worth following:</Text>
        <Text style={styles.questionSubtitle}>Here are some voices we think you'll love.</Text>

        <View style={styles.masonryRow}>
          <View style={styles.masonryCol}>{leftCreators.map(renderCreatorCard)}</View>
          <View style={styles.masonryCol}>{rightCreators.map(renderCreatorCard)}</View>
        </View>
      </WhiteScreen>
    );
  };

  const renderDiscoverStylists = () => {
    const filtered = stylistFilter === 'All'
      ? MOCK_STYLISTS
      : MOCK_STYLISTS.filter(s => s.specialty.toLowerCase().includes(stylistFilter.toLowerCase()));
    const leftStylists = filtered.filter((_, i) => i % 2 === 0);
    const rightStylists = filtered.filter((_, i) => i % 2 === 1);

    const renderStylistCard = (stylist) => {
      const followed = formData.followedStylists.includes(stylist.id);
      const initial = stylist.username[0].toUpperCase();
      return (
        <View key={stylist.id} style={[styles.personCard, { height: stylist.height }]}>
          <LinearGradient colors={stylist.colors} style={StyleSheet.absoluteFill} />
          <View style={styles.personCardBottom}>
            <View style={styles.personCardHeader}>
              <View style={styles.personAvatar}>
                <Text style={styles.personAvatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.personUsername}>{stylist.username}</Text>
                  <View style={styles.stylistBadge}>
                    <Text style={styles.stylistBadgeText}>Stylist</Text>
                  </View>
                </View>
                <View style={styles.personTagChip}>
                  <Text style={styles.personTagText}>{stylist.specialty}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.followBtn, followed && styles.followBtnActive]}
              onPress={() => toggleFollowStylist(stylist.id)}
            >
              <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
                {followed ? '✓ Following' : '+ Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };

    return (
      <WhiteScreen scrollable footer={<>
        <ContinueButton onPress={goNext} disabled={false} />
        <TouchableOpacity style={styles.skipLink} onPress={goNext}>
          <Text style={styles.skipLinkText}>Skip for now</Text>
        </TouchableOpacity>
      </>}>
        {renderBack()}
        {renderProgress()}
        <Text style={styles.questionTitle}>Discover talented stylists!</Text>
        <Text style={styles.questionSubtitle}>Follow stylists to keep their work in your feed.</Text>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterContent}
        >
          {STYLIST_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, stylistFilter === f && styles.filterChipActive]}
              onPress={() => setStylistFilter(f)}
            >
              <Text style={[styles.filterChipText, stylistFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.masonryRow}>
          <View style={styles.masonryCol}>{leftStylists.map(renderStylistCard)}</View>
          <View style={styles.masonryCol}>{rightStylists.map(renderStylistCard)}</View>
        </View>
      </WhiteScreen>
    );
  };

  // Its Continue button kicks off the actual signup/profile creation via
  // handleSignup(), which hands off to the app as soon as the account exists
  // — everything else finishes in the background with no visible loading step.
  const renderEndingBuffer = () => (
    <View style={styles.completeScreen}>
      <AnimatedGradientBackground />

      <View style={styles.completeTextBlock}>
        <Text style={styles.completeEyebrow}>WELCOME TO THE COMMUNITY</Text>
        <Text style={styles.completeTitle}>
          <Text style={styles.completeTitleDark}>your </Text>
          <Text style={styles.completeTitleMaroon}>crwn</Text>
          {'\n'}
          <Text style={styles.completeTitleDark}>profile is </Text>
          <Text style={styles.completeTitleItalic}>live.</Text>
        </Text>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.completeButtonWrap}>
        <TouchableOpacity style={styles.completeContinueBtn} onPress={goNext}>
          <Text style={styles.completeContinueBtnText}>Continue</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );

  // ── Step router ──────────────────────────────────────────────────────────────

  const renderCurrentStep = () => {
    switch (currentStep) {
      case STEPS.SPLASH:            return renderSplash();
      case STEPS.WELCOME:           return renderWelcome();
      case STEPS.EMAIL:             return renderEmail();
      case STEPS.NAME:              return renderName();
      case STEPS.PHONE_VERIFY:      return renderPhoneVerify();
      case STEPS.USERNAME:          return renderUsername();
      case STEPS.LOCATION:          return renderLocation();
      case STEPS.PROFILE_PHOTO:     return renderProfilePhoto();
      case STEPS.USER_TYPE:              return renderUserType();
      case STEPS.STYLIST_IMPORT:         return renderStylistImport();
      case STEPS.STYLIST_INSTAGRAM:      return renderStylistInstagram();
      case STEPS.STYLIST_REVIEW:         return renderStylistReview();
      case STEPS.STYLIST_BUFFER:         return renderStylistBuffer();
      case STEPS.STYLIST_WORK_TYPE:      return renderStylistWorkType();
      case STEPS.STYLIST_EXPERIENCE:     return renderStylistExperience();
      case STEPS.STYLIST_SPECIALTIES:    return renderStylistSpecialties();
      case STEPS.STYLIST_BUSINESS_NAME:  return renderStylistBusinessName();
      case STEPS.STYLIST_CREDENTIALS:    return renderStylistCredentials();
      case STEPS.STYLIST_BOOKING_LINK:   return renderStylistBookingLink();
      case STEPS.STYLIST_SOCIAL_LINKS:   return renderStylistSocialLinks();
      case STEPS.STYLIST_AVAILABILITY:   return renderStylistAvailability();
      case STEPS.STYLIST_BOOKING:        return renderStylistBooking();
      case STEPS.STYLIST_PORTFOLIO:      return renderStylistPortfolio();
      case STEPS.STYLIST_FIND_CREATORS:  return renderStylistFindCreators();
      case STEPS.USAGE_GOALS:            return renderUsageGoals();
      case STEPS.STYLES_LOADING:         return renderStylesLoading();
      case STEPS.HAIR_STYLES:            return renderHairStyles();
      case STEPS.CREATORS:          return renderCreators();
      case STEPS.DISCOVER_STYLISTS: return renderDiscoverStylists();
      case STEPS.ENDING_BUFFER:     return renderEndingBuffer();
      default:                      return renderSplash();
    }
  };

  if (showForgotPassword) {
    return <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />;
  }

  if (showAuth) {
    return (
      <AuthScreen
        onBack={() => setShowAuth(false)}
        onForgotPassword={() => { setShowAuth(false); setShowForgotPassword(true); }}
      />
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {renderCurrentStep()}
    </Animated.View>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

// Slowly crossfades between SUNSET_GRADIENTS on a continuous loop — simulates
// a drifting sunset rather than a single static gradient. Two stacked
// LinearGradients (current + next) with the top one's opacity animated from
// 0→1 reads as a smooth color/origin drift; expo-linear-gradient's `colors`
// prop can't be driven directly by Animated, so crossfading whole gradients
// is the reliable way to get this effect.
const AnimatedGradientBackground = () => {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    const anim = Animated.timing(fade, {
      toValue: 1,
      duration: 10000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setIndex(i => (i + 1) % SUNSET_GRADIENTS.length);
    });
    return () => anim.stop();
  }, [index]);

  const current = SUNSET_GRADIENTS[index];
  const next = SUNSET_GRADIENTS[(index + 1) % SUNSET_GRADIENTS.length];

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={current.colors} locations={current.locations} start={current.start} end={current.end} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <LinearGradient colors={next.colors} locations={next.locations} start={next.start} end={next.end} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
};

const GradientScreen = ({ children }) => (
  <LinearGradient
    colors={[colors.gradientTop, colors.gradientMiddle, colors.gradientBottom]}
    locations={[0, 0.5, 1]}
    style={{ flex: 1 }}
  >
    <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  </LinearGradient>
);

const WhiteScreen = ({ children, scrollable, footer, header }) => (
  <SafeAreaView style={styles.whiteContainer} edges={['top', 'bottom']}>
    {scrollable ? (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {header && <View style={styles.whiteHeader}>{header}</View>}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={header ? styles.whiteContentScrollableNoTop : styles.whiteContentScrollable}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer && <View style={styles.whiteFooter}>{footer}</View>}
      </KeyboardAvoidingView>
    ) : (
      <View style={styles.whiteContent}>{children}</View>
    )}
  </SafeAreaView>
);

const ContinueButton = ({ onPress, disabled, loading, label = 'Continue' }) => (
  <View style={styles.continueButtonContainer}>
    <TouchableOpacity
      style={[styles.continueButton, !disabled && styles.continueButtonActive]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading
        ? <ActivityIndicator size="small" color="#fff" />
        : <Text style={styles.continueButtonText}>{label}</Text>
      }
    </TouchableOpacity>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_GAP = 8;
const CARD_COL = (SCREEN_WIDTH - 24 * 2 - CARD_GAP) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // White screens
  whiteContainer: { flex: 1, backgroundColor: colors.white },
  whiteContent: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  whiteContentScrollable: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  whiteContentScrollableNoTop: { paddingHorizontal: 24, paddingBottom: 16 },
  whiteHeader: { paddingHorizontal: 24, paddingTop: 20 },
  whiteFooter: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },

  // Back button
  backButton: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, marginLeft: -8,
  },

  // Progress bar
  progressContainer: { flexDirection: 'row', gap: 6, marginBottom: 32 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E8DDD0' },
  progressDotCompleted: { backgroundColor: '#1A1612' },
  progressDotCurrent: { backgroundColor: '#C4956A' },

  // Splash
  splashContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  splashLogo: { fontSize: 48, fontFamily: 'LibreBaskerville_700Bold', color: '#5D3A1A' },
  splashTagline: { fontSize: 17, color: '#5D3A1A', marginTop: 12, fontStyle: 'italic', fontFamily: 'LibreBaskerville_400Regular' },

  // Welcome
  welcomeContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  welcomeLogo: { fontSize: 64, fontFamily: 'LibreBaskerville_700Bold', color: '#5D3A1A', lineHeight: 72 },
  welcomeTagline: { fontSize: 18, fontFamily: 'LibreBaskerville_400Regular', color: '#5D3A1A', marginTop: 10, fontStyle: 'italic' },
  welcomeButtons: { paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center', width: '100%' },
  createAccountButton: { backgroundColor: '#5D1F1F', paddingVertical: 18, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 12 },
  createAccountText: { color: colors.white, fontSize: 16, fontFamily: 'Figtree_600SemiBold', letterSpacing: 0.3 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.9)', paddingVertical: 16, borderRadius: 14, width: '100%', marginBottom: 20 },
  googleButtonText: { color: '#5D3A1A', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  signInText: { color: 'rgba(255,255,255,0.85)', fontSize: 15 },
  signInLink: { fontFamily: 'Figtree_700Bold', color: '#fff' },

  // Question text
  questionTitle: { fontSize: 24, fontFamily: 'LibreBaskerville_700Bold', color: colors.textPrimary, marginBottom: 10 },
  questionSubtitle: { fontSize: 14, fontFamily: 'Figtree_400Regular', color: colors.textSecondary, marginBottom: 24, lineHeight: 20 },

  // Inputs
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontFamily: 'Figtree_400Regular' },
  input: { borderWidth: 1, borderColor: '#D1D1D1', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.white, fontFamily: 'Figtree_400Regular' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D1D1', borderRadius: 10, backgroundColor: colors.white },
  passwordInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, fontSize: 15, color: colors.textPrimary, fontFamily: 'Figtree_400Regular' },
  eyeButton: { paddingHorizontal: 12 },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  pwRulesWrap: { marginTop: 10, gap: 5 },
  pwRulesTitle: { fontSize: 12, color: '#666', marginBottom: 2, fontFamily: 'Figtree_500Medium' },
  pwRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwRuleText: { fontSize: 12, color: '#AAAAAA', fontFamily: 'Figtree_400Regular' },
  pwRuleTextMet: { color: '#3B7A3B' },

  // OTP-style phone verification code input
  otpInput: { borderWidth: 1, borderColor: '#D1D1D1', borderRadius: 10, paddingVertical: 16, fontSize: 24, letterSpacing: 12, color: colors.textPrimary, backgroundColor: colors.white, fontFamily: 'Figtree_600SemiBold' },

  // Username input
  usernameInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D1D1', borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 16 },
  usernameAt: { fontSize: 16, color: colors.textSecondary, marginRight: 4, fontFamily: 'Figtree_500Medium' },
  usernameInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textPrimary, fontFamily: 'Figtree_400Regular' },

  // Icon-prefixed inputs (social links)
  iconInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D1D1', borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 16 },
  iconInputIcon: { marginRight: 10 },
  iconInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textPrimary, fontFamily: 'Figtree_400Regular' },

  // User type fork
  userTypeFork: { gap: 14, marginBottom: 28 },
  userTypeCard: {
    borderWidth: 1.5, borderColor: '#D1D1D1', borderRadius: 16,
    padding: 20, position: 'relative',
  },
  userTypeCardSelected: { borderColor: '#3F523F', backgroundColor: '#F4F7F4' },
  userTypeCardIcon: { fontSize: 28, marginBottom: 10 },
  userTypeCardTitle: { fontSize: 17, fontFamily: 'LibreBaskerville_700Bold', color: colors.copper, marginBottom: 6 },
  userTypeCardDesc: { fontSize: 13, fontFamily: 'Figtree_400Regular', color: colors.textSecondary, lineHeight: 18 },
  userTypeCheckmark: { position: 'absolute', top: 16, right: 16 },

  // Option buttons (single + multi select for stylist screens)
  optionsContainer: { gap: 12, marginBottom: 8 },
  optionButton: { borderWidth: 1, borderColor: '#D8D0C8', borderRadius: 12, paddingVertical: 18, paddingHorizontal: 20, backgroundColor: colors.white },
  optionButtonSelected: { borderColor: '#4F4032', backgroundColor: '#F5F0E8' },
  optionText: { fontSize: 15, color: colors.textPrimary, fontFamily: 'Figtree_400Regular' },
  optionTextSelected: { color: colors.textBrown, fontFamily: 'Figtree_600SemiBold' },

  // Continue button
  continueButtonContainer: { marginTop: 'auto', paddingBottom: 12 },
  continueButton: { backgroundColor: '#869086', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  continueButtonActive: { backgroundColor: '#3F523F' },
  continueButtonText: { color: colors.white, fontSize: 15, fontFamily: 'Figtree_600SemiBold' },

  // Skip link
  skipLink: { alignItems: 'center', paddingBottom: 8, paddingTop: 4 },
  skipLinkText: { fontSize: 13, color: colors.textSecondary, fontFamily: 'Figtree_400Regular' },

  // Profile photo
  photoPickerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 32 },
  avatarPickerWrap: { position: 'relative', marginBottom: 16 },
  avatarPreview: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F0EAE0', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E8DDD0' },
  avatarEditBadge: { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#3F523F', alignItems: 'center', justifyContent: 'center' },
  choosePhotoBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: '#4F4032' },
  choosePhotoBtnText: { fontSize: 14, color: colors.textBrown, fontFamily: 'Figtree_500Medium' },

  // Hair styles grid
  stylesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  styleChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: '#D1D1D1', backgroundColor: colors.white },
  styleChipSelected: { borderColor: '#4F4032', backgroundColor: '#F5F0E8' },
  styleChipText: { fontSize: 14, color: colors.textPrimary, fontFamily: 'Figtree_400Regular' },
  styleChipTextSelected: { color: colors.textBrown, fontFamily: 'Figtree_500Medium' },

  // Masonry grid for creators/stylists
  masonryRow: { flexDirection: 'row', gap: CARD_GAP, marginBottom: 16 },
  masonryCol: { flex: 1, gap: CARD_GAP },

  // Styles-loading skeleton (STYLES_LOADING)
  skeletonCard: { width: CARD_COL, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end', padding: 10 },
  skeletonLabel: { width: '50%', height: 14, borderRadius: 7, backgroundColor: '#D4CCC0' },

  // Hair look cards (redesigned HAIR_STYLES grid)
  // Dark gradient behind the label — same treatment as the Explore feed's stylist tag
  lookCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  lookCardGlow: {
    borderRadius: 14,
    shadowColor: colors.honey,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  lookCheckmark: { position: 'absolute', top: 10, right: 10, zIndex: 1 },
  lookCardTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  lookCardTagText: { fontSize: 12, fontFamily: 'Figtree_600SemiBold', color: colors.white },

  // Person card (creators + stylists)
  personCard: {
    width: CARD_COL,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  personCardBottom: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 10,
    gap: 8,
  },
  personCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#D4C4B0', alignItems: 'center', justifyContent: 'center',
  },
  personAvatarText: { fontSize: 14, fontFamily: 'Figtree_700Bold', color: '#5D3A1A' },
  personUsername: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: '#1A1A1A' },
  personTagChip: { marginTop: 2, alignSelf: 'flex-start', backgroundColor: '#F0EAE0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  personTagText: { fontSize: 11, color: '#5D3A1A', fontFamily: 'Figtree_400Regular' },
  followBtn: { borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  followBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  followBtnText: { fontSize: 13, fontFamily: 'Figtree_500Medium', color: '#1A1A1A' },
  followBtnTextActive: { color: '#fff' },

  // Stylist badge
  stylistBadge: { backgroundColor: '#3F523F', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  stylistBadgeText: { fontSize: 10, color: '#fff', fontFamily: 'Figtree_600SemiBold' },

  // Filter chips (discover stylists)
  filterBar: { marginTop: 16, marginBottom: 16, flexGrow: 0 },
  filterContent: { gap: 8, paddingRight: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 5, backgroundColor: '#F3F0EB' },
  filterChipActive: { backgroundColor: '#4A5E4A' },
  filterChipText: { fontSize: 13, fontFamily: 'Figtree_500Medium', color: '#5E5E5E' },
  filterChipTextActive: { color: '#fff' },

  // Services & pricing (booking step)
  serviceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  serviceNameInput: { flex: 1, borderWidth: 1, borderColor: '#D1D1D1', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, fontSize: 14, color: colors.textPrimary, fontFamily: 'Figtree_400Regular' },
  servicePriceWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D1D1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 11, width: 90 },
  serviceDollar: { fontSize: 14, color: colors.textSecondary, marginRight: 2, fontFamily: 'Figtree_500Medium' },
  servicePriceInput: { flex: 1, fontSize: 14, color: colors.textPrimary, fontFamily: 'Figtree_400Regular', padding: 0 },
  serviceRemove: { padding: 4 },
  addServiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, marginTop: 4 },
  addServiceText: { fontSize: 14, color: colors.forest, fontFamily: 'Figtree_600SemiBold' },

  // Credentials photo upload (STYLIST_CREDENTIALS)
  credentialsUploadBox: { borderWidth: 1.5, borderColor: '#D1D1D1', borderRadius: 16, paddingVertical: 48, alignItems: 'center', justifyContent: 'center', marginVertical: 24, overflow: 'hidden' },
  credentialsUploadBoxFilled: { paddingVertical: 0 },
  credentialsPreview: { width: '100%', height: 200, borderRadius: 14 },

  // Portfolio upload
  portfolioUploadBox: { borderWidth: 1.5, borderColor: '#D1D1D1', borderRadius: 16, paddingVertical: 48, alignItems: 'center', justifyContent: 'center', marginVertical: 24 },
  portfolioUploadIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F8B430', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  portfolioUploadTitle: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: colors.textPrimary, marginBottom: 4 },
  portfolioUploadSub: { fontSize: 13, fontFamily: 'Figtree_400Regular', color: colors.textSecondary },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 20 },
  portfolioThumbWrap: { position: 'relative', width: (SCREEN_WIDTH - 48 - 16) / 3, height: (SCREEN_WIDTH - 48 - 16) / 3 },
  portfolioThumb: { width: '100%', height: '100%', borderRadius: 10 },
  portfolioThumbRemove: { position: 'absolute', top: 4, right: 4 },
  portfolioAddMore: { width: (SCREEN_WIDTH - 48 - 16) / 3, height: (SCREEN_WIDTH - 48 - 16) / 3, borderRadius: 10, borderWidth: 1.5, borderColor: '#D1D1D1', alignItems: 'center', justifyContent: 'center' },

  // Ending buffer
  endingContainer: { flex: 1, backgroundColor: '#F0EAE0', justifyContent: 'space-between' },
  endingEyebrow: { fontSize: 11, fontFamily: 'Figtree_600SemiBold', color: '#8B7355', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 },
  endingTitle: { fontSize: 48, fontFamily: 'LibreBaskerville_700Bold', color: '#1A1612', lineHeight: 56 },
  endingTitlePlain: { fontSize: 48, fontFamily: 'LibreBaskerville_700Bold', color: '#1A1612' },
  endingTitleCopper: { fontSize: 48, fontFamily: 'LibreBaskerville_400Regular', color: '#C4956A', fontStyle: 'italic' },
  endingBottom: { paddingHorizontal: 24, paddingBottom: 32 },
  endingContinueBtn: { backgroundColor: '#3F523F', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  endingContinueBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },

  // Location pickers
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  pickerButtonText: { fontSize: 15, color: colors.textPrimary, fontFamily: 'Figtree_400Regular', flex: 1 },
  pickerPlaceholder: { color: '#999' },
  pickerModal: { flex: 1, backgroundColor: colors.white },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  pickerModalTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold', color: colors.textPrimary },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 10,
    backgroundColor: '#F9F9F9',
  },
  pickerSearchInput: { flex: 1, fontSize: 15, color: colors.textPrimary, fontFamily: 'Figtree_400Regular' },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  pickerItemSelected: { backgroundColor: '#FFF8F2' },
  pickerItemText: { flex: 1, fontSize: 15, color: colors.textPrimary, fontFamily: 'Figtree_400Regular' },
  pickerItemTextSelected: { color: colors.primary, fontFamily: 'Figtree_600SemiBold' },
  pickerItemAbbr: { fontSize: 13, color: '#999', fontFamily: 'Figtree_400Regular', marginRight: 8 },
  pickerSep: { height: StyleSheet.hairlineWidth, backgroundColor: '#EFEFEF', marginLeft: 20 },

  // Import flow
  importScrapeBtn: {
    backgroundColor: '#3F523F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  importScrapeBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  importResultCard: {
    borderWidth: 1,
    borderColor: '#D8D0C8',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#FDFAF6',
    marginBottom: 8,
    gap: 8,
  },
  importResultBiz: { fontSize: 16, fontFamily: 'Figtree_700Bold', color: colors.textPrimary },
  importResultLabel: { fontSize: 13, fontFamily: 'Figtree_500Medium', color: colors.textSecondary, marginBottom: 4 },
  importResultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  importResultServiceName: { flex: 1, fontSize: 14, fontFamily: 'Figtree_400Regular', color: colors.textPrimary },
  importResultPrice: { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: colors.forest, marginLeft: 8 },
  importResultMore: { fontSize: 12, color: colors.textSecondary, fontFamily: 'Figtree_400Regular', fontStyle: 'italic' },
  importConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#833AB4',
    paddingVertical: 16,
    borderRadius: 14,
    marginVertical: 12,
  },
  importConnectBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  importPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  importPhotoThumb: {
    width: (SCREEN_WIDTH - 48 - 12) / 3,
    height: (SCREEN_WIDTH - 48 - 12) / 3,
    borderRadius: 8,
  },
  igPhotoCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // Review step
  reviewSection: {
    borderWidth: 1,
    borderColor: '#E8DDD0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  reviewSectionTitle: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reviewSectionValue: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: colors.textPrimary },
  reviewEmptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  reviewEmptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, fontFamily: 'Figtree_400Regular' },
  reviewPostHint: { fontSize: 12, color: '#B0A090', fontFamily: 'Figtree_400Regular', marginBottom: 8 },
  reviewPostCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8DF',
  },
  reviewPostThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F0E8DF',
  },
  reviewPostCaption: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E8DDD0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 64,
    textAlignVertical: 'top',
  },

  // Completion + stylist-buffer screens (shared animated gradient background)
  completeScreen: { flex: 1 },
  completeTextBlock: { position: 'absolute', top: '40%', left: 0, right: 0, paddingHorizontal: 32 },
  completeEyebrow: {
    fontSize: 11,
    fontFamily: 'Figtree_600SemiBold',
    color: '#4F4032',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    textAlign: 'center',
  },
  completeTitle: { fontSize: 34, lineHeight: 40, textAlign: 'center' },
  completeTitleDark: { fontFamily: 'LibreBaskerville_700Bold', color: colors.textPrimary, fontSize: 34 },
  completeTitleMaroon: { fontFamily: 'LibreBaskerville_700Bold', color: colors.maroon, fontSize: 34 },
  completeTitleItalic: { fontFamily: 'LibreBaskerville_400Regular', fontStyle: 'italic', color: colors.burntOchre, fontSize: 34 },
  completeButtonWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: 16 },
  completeContinueBtn: { backgroundColor: colors.forest, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  completeContinueBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Figtree_600SemiBold' },
  stylistBufferEyebrow: {
    fontSize: 11,
    fontFamily: 'Figtree_600SemiBold',
    color: '#4F4032',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
});
