import ScrollableCard from '../components/ScrollableCard';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Modal,
 ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { ArrowLeft, Ban, CheckCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import apiClient from '../services/ApiClient';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type RootStackParamList = {
	AdminDashboard: undefined;
	UserManagement: undefined;
};

type Props = StackScreenProps<RootStackParamList, 'UserManagement'>;

type RegisteredUser = {
	id: number | string;
	fullName: string;
	email: string;
	role: string;
	status?: string;
};

const USERS_PER_PAGE = 4;
const FILTERS = ['ALL', 'RIDER', 'DRIVER', 'SUSPENDED'] as const;
type UserFilter = typeof FILTERS[number];

export default function UserManagementScreen({ navigation }: Props) {
	const [users, setUsers] = useState<RegisteredUser[]>([]);
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	 const [filter, setFilter] = useState<UserFilter>('ALL');
	 const [updatingId, setUpdatingId] = useState<number | string | null>(null);
	 const [pendingStatusChange, setPendingStatusChange] = useState<RegisteredUser | null>(null);

	const loadUsers = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await apiClient.get('/admin/users');
			setUsers(Array.isArray(response.data) ? response.data : []);
		} catch (err: any) {
			setError(err?.response?.data?.error || 'Could not load registered users');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

	const filteredUsers = useMemo(() => {
		const query = search.trim().toLowerCase();
		return users.filter((user) => {
			const matchesSearch = !query || `${user.fullName} ${user.email}`.toLowerCase().includes(query);
			const matchesFilter = filter === 'ALL'
				? true
				: filter === 'SUSPENDED'
					? user.status?.toUpperCase() === 'SUSPENDED'
					: user.role.toUpperCase() === filter;
			return matchesSearch && matchesFilter;
		});
	}, [filter, search, users]);

	const pageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
	const safePage = Math.min(page, pageCount - 1);
	const visibleUsers = filteredUsers.slice(
		safePage * USERS_PER_PAGE,
		safePage * USERS_PER_PAGE + USERS_PER_PAGE
	);

	const updateSearch = (value: string) => {
		setSearch(value);
		setPage(0);
	};

	 const changeFilter = (nextFilter: UserFilter) => {
		setFilter(nextFilter);
		setPage(0);
	 };

	 const updateStatus = (user: RegisteredUser) => setPendingStatusChange(user);

	 const confirmStatusChange = async () => {
		if (!pendingStatusChange) return;
		const user = pendingStatusChange;
		const nextStatus = user.status?.toUpperCase() === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
		setPendingStatusChange(null);
		setUpdatingId(user.id);
		try {
			await apiClient.put(`/admin/users/${user.id}/status`, { status: nextStatus });
			setUsers((current) => current.map((item) => item.id === user.id ? { ...item, status: nextStatus } : item));
		} catch (err: any) {
			setError(err?.response?.data?.error || 'Could not update account. Please try again.');
		} finally {
			setUpdatingId(null);
		}
	 };

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
					<ArrowLeft size={20} color={colors.greenDark} strokeWidth={2} />
					<Text style={styles.backText}>Back</Text>
				</TouchableOpacity>
				<Text style={styles.title}>User Management</Text>
			</View>

			<ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
				<View style={styles.searchBox}>
					<Search size={19} color={colors.gray800} strokeWidth={2} />
					<TextInput
						value={search}
						onChangeText={updateSearch}
						placeholder="Search users..."
						placeholderTextColor={colors.gray500}
						style={[styles.searchInput, { outlineStyle: 'none' } as any]}
						autoCapitalize="none"
					/>
				</View>
				<View style={styles.filterRow}>
					{FILTERS.map((item) => (
						<TouchableOpacity key={item} onPress={() => changeFilter(item)} style={[styles.filterButton, filter === item && styles.selectedFilter]}>
							<Text style={[styles.filterText, filter === item && styles.selectedFilterText]}>{item === 'ALL' ? 'All users' : item[0] + item.slice(1).toLowerCase()}</Text>
						</TouchableOpacity>
					))}
				</View>

				{loading ? (
					<ActivityIndicator style={styles.loader} size="large" color={colors.green} />
				) : error ? (
					<View style={styles.emptyState}>
						<Text style={styles.emptyTitle}>{error}</Text>
						<TouchableOpacity onPress={loadUsers} style={styles.retryButton}>
							<Text style={styles.retryText}>Retry</Text>
						</TouchableOpacity>
					</View>
				) : (
					<>
						<Text style={styles.resultText}>
							{filteredUsers.length} registered {filteredUsers.length === 1 ? 'user' : 'users'}
						</Text>
						{visibleUsers.length === 0 ? (
							<View style={styles.emptyState}>
								<Text style={styles.emptyTitle}>No registered users found</Text>
							</View>
						) : (
								<View style={styles.userList}>
									{visibleUsers.map((user, index) => <UserCard key={user.id} user={user} index={index} updating={updatingId === user.id} onToggleStatus={() => updateStatus(user)} />)}
								</View>
						)}

					</>
				)}
			</ScrollView>
				<View style={styles.pagination}>
					<TouchableOpacity
						style={[styles.pageButton, safePage === 0 && styles.disabledButton]}
						onPress={() => setPage(Math.max(0, safePage - 1))}
						disabled={safePage === 0}
					>
						<ChevronLeft size={18} color={safePage === 0 ? colors.gray500 : colors.gray800} />
						<Text style={[styles.pageButtonText, safePage === 0 && styles.disabledText]}>Previous</Text>
					</TouchableOpacity>
					<Text style={styles.pageCount}>Page {safePage + 1} of {pageCount}</Text>
					<TouchableOpacity
						style={[styles.pageButton, safePage >= pageCount - 1 && styles.disabledButton]}
						onPress={() => setPage(Math.min(pageCount - 1, safePage + 1))}
						disabled={safePage >= pageCount - 1}
					>
						<Text style={[styles.pageButtonText, safePage >= pageCount - 1 && styles.disabledText]}>Next</Text>
						<ChevronRight size={18} color={safePage >= pageCount - 1 ? colors.gray500 : colors.gray800} />
					</TouchableOpacity>
				</View>
			<Modal visible={pendingStatusChange !== null} transparent animationType="fade" onRequestClose={() => setPendingStatusChange(null)}>
				<View style={styles.modalOverlay}>
					<ScrollableCard style={styles.confirmModal}>
						<Text style={styles.confirmTitle}>{pendingStatusChange?.status?.toUpperCase() === 'SUSPENDED' ? 'Unsuspend account?' : 'Suspend account?'}</Text>
						<Text style={styles.confirmMessage}>
							Are you sure you want to {pendingStatusChange?.status?.toUpperCase() === 'SUSPENDED' ? 'unsuspend' : 'suspend'} {pendingStatusChange?.fullName}'s account?
						</Text>
						<View style={styles.confirmActions}>
							<TouchableOpacity style={styles.cancelButton} onPress={() => setPendingStatusChange(null)}>
								<Text style={styles.cancelText}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity style={styles.confirmButton} onPress={confirmStatusChange}>
								<Text style={styles.confirmText}>{pendingStatusChange?.status?.toUpperCase() === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'}</Text>
							</TouchableOpacity>
						</View>
					</ScrollableCard>
				</View>
			</Modal>
		</View>
	);
}

function UserCard({ user, index, updating, onToggleStatus }: { user: RegisteredUser; index: number; updating: boolean; onToggleStatus: () => void }) {
	const initials = user.fullName
		.split(' ')
		.map((part) => part[0])
		.slice(0, 2)
		.join('')
		.toUpperCase();
	const suspended = user.status?.toUpperCase() === 'SUSPENDED';

	return (
		<View style={styles.userCard}>
			<View style={[styles.avatar, index % 2 === 0 ? styles.greenAvatar : styles.blueAvatar]}>
				<Text style={styles.avatarText}>{initials}</Text>
			</View>
			<View style={styles.userInfo}>
				<Text style={styles.userName} numberOfLines={1}>{user.fullName}</Text>
				<Text style={styles.userMeta} numberOfLines={1}>{user.email} • {user.role}</Text>
			</View>
			<View style={[styles.statusBadge, suspended ? styles.suspendedBadge : styles.activeBadge]}>
				<Text style={[styles.statusText, suspended ? styles.suspendedText : styles.activeText]}>
					{user.status || 'PENDING'}
				</Text>
			</View>
			<TouchableOpacity accessibilityLabel={`${suspended ? 'Unsuspend' : 'Suspend'} ${user.fullName}`} style={[styles.suspendButton, suspended && styles.unsuspendButton]} onPress={onToggleStatus} disabled={updating}>
				{suspended ? <CheckCircle size={18} color={colors.greenDark} strokeWidth={2} /> : <Ban size={18} color={colors.red} strokeWidth={2} />}
				<Text style={[styles.suspendText, suspended && styles.unsuspendText]}>{updating ? 'Updating...' : suspended ? 'Unsuspend Account' : 'Suspend Account'}</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.gray50 },
	header: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
	backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm },
	backText: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 14 },
	title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 24, fontWeight: '800' },
	content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.lg },
	searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderColor: colors.gray200, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.lg, height: 52, ...shadow.sm },
	searchInput: { flex: 1, color: colors.gray900, fontFamily: font.regular, fontSize: 14 },
	filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.md, width: '100%' },
	filterButton: { flexGrow: 1, flexBasis: 80, minHeight: 44, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
	selectedFilter: { backgroundColor: colors.gray900, borderColor: colors.gray900 },
	filterText: { color: colors.gray600, fontFamily: font.semibold, fontSize: 12 },
	selectedFilterText: { color: colors.white },
	loader: { marginTop: spacing.xxxl },
	resultText: { color: colors.gray500, fontFamily: font.medium, fontSize: 12, marginTop: spacing.lg, marginBottom: spacing.sm },
	userList: { paddingBottom: spacing.xl },
	userScroll: { flex: 1, minHeight: 0 },
	userCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', ...shadow.sm },
	avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
	greenAvatar: { backgroundColor: colors.green },
	blueAvatar: { backgroundColor: colors.blue },
	avatarText: { color: colors.white, fontFamily: font.bold, fontSize: 12 },
	userInfo: { flex: 1, minWidth: 100 },
	userName: { color: colors.gray900, fontFamily: font.bold, fontSize: 14 },
	userMeta: { color: colors.gray400, fontFamily: font.regular, fontSize: 10, marginTop: 1 },
	statusBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4, marginLeft: spacing.xs },
	activeBadge: { backgroundColor: colors.greenLight },
	inactiveBadge: { backgroundColor: colors.orangeLight },
	suspendedBadge: { backgroundColor: colors.redLight },
	statusText: { fontFamily: font.bold, fontSize: 9 },
	activeText: { color: colors.greenDark },
	inactiveText: { color: colors.orange },
	suspendedText: { color: colors.red },
	suspendButton: { width: '100%', height: 38, borderWidth: 1, borderColor: colors.redLight, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.sm },
	suspendText: { color: colors.red, fontFamily: font.semibold, fontSize: 12 },
	unsuspendButton: { borderColor: colors.greenLight },
	unsuspendText: { color: colors.greenDark },
	pagination: { flexShrink: 0, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, borderTopWidth: 1, borderTopColor: colors.gray200, backgroundColor: colors.gray50, zIndex: 10, elevation: 10 },
	pageButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
	disabledButton: { backgroundColor: colors.gray100, borderColor: colors.gray100 },
	pageButtonText: { color: colors.gray800, fontFamily: font.semibold, fontSize: 13 },
	disabledText: { color: colors.gray300 },
	pageCount: { color: colors.gray500, fontFamily: font.medium, fontSize: 12 },
	emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
	emptyTitle: { color: colors.gray600, fontFamily: font.semibold, fontSize: 14, textAlign: 'center' },
	retryButton: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.green },
	retryText: { color: colors.white, fontFamily: font.semibold, fontSize: 13 },
	modalOverlay: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
	confirmModal: { width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, ...shadow.lg },
	confirmTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 18, textAlign: 'center' },
	confirmMessage: { color: colors.gray600, fontFamily: font.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.md },
	confirmActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
	cancelButton: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
	cancelText: { color: colors.gray700, fontFamily: font.semibold, fontSize: 13 },
	confirmButton: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
	confirmText: { color: colors.white, fontFamily: font.semibold, fontSize: 13 },
});
