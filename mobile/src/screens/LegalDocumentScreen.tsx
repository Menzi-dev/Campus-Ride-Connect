import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing } from '../theme/theme';

type LegalDocument = 'terms' | 'privacy';
type LegalNavigation = {
  Legal: { document: LegalDocument };
};

const TERMS = [
  {
    heading: '1. About CampusConnect',
    paragraphs: [
      'CampusConnect helps members of the Sol Plaatje University community coordinate campus rides, communicate about a ride, manage ride requests, and contact campus safety through an in-app SOS feature. It is a coordination tool, not a transport operator or emergency service.',
    ],
  },
  {
    heading: '2. Accounts and eligibility',
    paragraphs: [
      'Use accurate, current information and keep your password and one-time codes private. You are responsible for activity carried out through your account and should promptly report suspected unauthorized access to your campus administrator.',
      'Driver accounts may require review and approval before driver features are available. Do not misrepresent your identity, student status, vehicle, or driving eligibility.',
    ],
  },
  {
    heading: '3. Rides and safety',
    paragraphs: [
      'Riders and drivers are responsible for confirming ride details, following applicable laws and campus rules, and treating one another respectfully. Ride availability, pickup times, routes, and arrival times are not guaranteed.',
      'The SOS feature creates an in-app alert for campus safety personnel. It may not be monitored continuously and is not a substitute for emergency services. In an emergency in South Africa, call 112 from a mobile phone or 10111 for police.',
    ],
  },
  {
    heading: '4. Acceptable use',
    paragraphs: [
      'Do not use CampusConnect to harass, threaten, defraud, stalk, or endanger another person; submit false information; misuse location or SOS features; or interfere with the service. You must have permission to submit information or recordings about another person.',
    ],
  },
  {
    heading: '5. Payments',
    paragraphs: [
      'The app can record a selected payment method and create a ride payment record with a pending status. The current implementation does not connect to a card-processing or settlement provider, so a pending record is not proof that money was charged or paid.',
      'Saved-card records contain limited display details such as brand, last four digits, expiry, and cardholder name. The backend does not receive or store the full card number or CVV through the saved-card feature.',
    ],
  },
  {
    heading: '6. Availability and account action',
    paragraphs: [
      'Features may be unavailable, changed, or withdrawn for maintenance, safety, legal, or operational reasons. CampusConnect administrators may restrict or suspend accounts for suspected misuse or to protect the campus community, subject to applicable law and university procedures.',
    ],
  },
  {
    heading: '7. Limits and applicable rights',
    paragraphs: [
      'CampusConnect is provided as a ride-coordination tool. To the extent permitted by law, the university and service operators are not responsible for independent conduct of riders or drivers, missed rides, or interruption of the service. Nothing in these terms excludes rights or responsibilities that cannot legally be excluded.',
      'These terms are intended for use at Sol Plaatje University in South Africa and are subject to applicable South African law and university policies.',
    ],
  },
  {
    heading: '8. Changes and contact',
    paragraphs: [
      'Material changes will be reflected in the app. For help, safety concerns, or questions about these terms, contact your university CampusConnect administrator through the support channels provided by your institution.',
    ],
  },
  {
    heading: '9. Agreement',
    paragraphs: [
      'By selecting the agreement checkbox during registration and using CampusConnect, you confirm that you have read and agree to these Terms of Service. If you do not agree, do not complete registration or use the service.',
    ],
  },
];

const PRIVACY = [
  {
    heading: '1. Information the app handles',
    paragraphs: [
      'Account information can include your name, university email, student number, phone number, year of study, role, emergency contact, and a password hash. Driver profiles can include vehicle details, licence plate, and a vehicle photo.',
      'The identity-verification flow captures a selfie image and associates the submitted image with your account for verification. The current implementation stores that image in the user record; it does not create a separate derived face template.',
    ],
  },
  {
    heading: '2. Rides, location, and safety',
    paragraphs: [
      'When you use ride features, the app may handle pickup and destination details and coordinates, ride times and status, and driver location updates. Your device location is requested for pickup and nearby-place features; location is sent to the backend when needed for a ride or SOS operation.',
      'An SOS record may include the ride, your account, GPS coordinates, and an audio recording you choose to submit. SOS audio is stored on the backend server. Do not record or submit another person’s voice unless you have a lawful basis to do so.',
    ],
  },
  {
    heading: '3. Messages and payment details',
    paragraphs: [
      'Messages sent through ride chat are stored with the ride and sender so ride participants can view the conversation.',
      'Saved payment methods store limited details for display and ride association: card brand, last four digits, expiry, and cardholder name. The saved-card API does not receive or store the full card number or CVV. Ride payment records may remain marked pending because no card processor is connected in the current implementation.',
    ],
  },
  {
    heading: '4. Why information is used',
    paragraphs: [
      'Information is used to create and secure accounts; verify and approve driver accounts; arrange and manage rides; show relevant ride and driver details to participants; support campus safety alerts; maintain ride chat and payment records; prevent misuse; and respond to support or legal requests.',
    ],
  },
  {
    heading: '5. Who may receive information',
    paragraphs: [
      'Information is available to the rider and driver when needed for their ride. Authorized CampusConnect administrators and campus safety personnel may access information needed for account administration, driver approval, ride operations, or an SOS response.',
      'Password-reset emails are sent through Gmail SMTP to the address entered for the reset request. Map tiles are requested from OpenStreetMap servers; those requests can disclose technical connection data such as your IP address to that provider. The app does not implement advertising or data-sale features.',
    ],
  },
  {
    heading: '6. Storage and retention',
    paragraphs: [
      'Account and service records are stored by the CampusConnect backend in its MySQL database; SOS audio is stored in backend file storage. The app also keeps session and some profile data on the device to support sign-in and app operation.',
      'The current project does not define a complete automatic deletion schedule. Records may remain while needed to operate the service, address safety or disputes, or meet university and legal obligations. For access, correction, or deletion requests, contact your university CampusConnect administrator or Information Officer; requests are handled under applicable law, including South Africa’s Protection of Personal Information Act (POPIA) where applicable, and retention requirements.',
    ],
  },
  {
    heading: '7. Security and your choices',
    paragraphs: [
      'Passwords are stored using a one-way password hash. Access to account and ride functions requires authentication, and administrative features use role-based access. No online service can guarantee absolute security; protect your login and never share a password-reset code.',
      'You can control device permissions such as location and camera in your device settings. Denying a permission may prevent the related ride, location, or verification feature from working.',
    ],
  },
  {
    heading: '8. Privacy questions and changes',
    paragraphs: [
      'This notice describes the current app implementation and may change as the service changes. For privacy questions or to exercise applicable rights, contact your university CampusConnect administrator or Information Officer through your institution’s support channels. This notice should be reviewed by Sol Plaatje University’s legal and information-protection staff before production use.',
    ],
  },
];

export default function LegalDocumentScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<LegalNavigation, 'Legal'>>();
  const insets = useSafeAreaInsets();
  const isPrivacy = route.params.document === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const sections = isPrivacy ? PRIVACY : TERMS;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to account creation"
        >
          <ChevronLeft size={20} color={colors.greenDark} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.updated}>Last updated: 28 September 2026</Text>
        <Text style={styles.reviewNotice}>
          This document reflects the current CampusConnect app. It should be reviewed by Sol Plaatje University before production use.
        </Text>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.heading}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.white },
  scrollView: { flex: 1, minHeight: 0 },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 40, gap: spacing.xs },
  backText: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 14 },
  title: { marginTop: spacing.sm, color: colors.gray900, fontFamily: font.extrabold, fontSize: 28 },
  updated: { marginTop: spacing.xs, color: colors.gray500, fontFamily: font.medium, fontSize: 12 },
  reviewNotice: { marginTop: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.gray200, color: colors.gray600, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  section: { marginTop: spacing.lg },
  sectionTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 16, marginBottom: spacing.xs },
  paragraph: { color: colors.gray700, fontFamily: font.regular, fontSize: 14, lineHeight: 21, marginBottom: spacing.sm },
});
