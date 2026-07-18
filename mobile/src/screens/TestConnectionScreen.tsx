import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import apiClient from '../services/ApiClient';

const TestConnectionScreen = () => {
    const [loading, setLoading] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string>('Not tested');
    const [users, setUsers] = useState<any[]>([]);
    const [backendMessage, setBackendMessage] = useState('');

    const testConnection = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/api/test/connection');
            setConnectionStatus(`✅ ${response.data.status} - ${response.data.message}`);
            Alert.alert('Success', `Connected to ${response.data.database}`);
        } catch (error: any) {
            setConnectionStatus(`❌ Connection Failed: ${error.message}`);
            Alert.alert('Error', `Could not connect to backend: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const testHello = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/api/test/hello');
            setBackendMessage(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const getUsers = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/api/users');
            setUsers(Array.isArray(response.data) ? response.data : []);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>🔗 Backend Connection Test</Text>

            {/* Connection Status */}
            <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Status:</Text>
                <Text style={[
                    styles.statusValue,
                    connectionStatus.includes('✅') ? styles.success : styles.error
                ]}>
                    {connectionStatus}
                </Text>
            </View>

            {/* Backend Message */}
            {backendMessage ? (
                <View style={styles.messageCard}>
                    <Text style={styles.messageText}>{backendMessage}</Text>
                </View>
            ) : null}

            {/* Buttons */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={testConnection}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Test Connection</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={testHello}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>Test Hello</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={getUsers}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>Get Users</Text>
                </TouchableOpacity>
            </View>

            {/* Users List */}
            {users.length > 0 && (
                <View style={styles.usersCard}>
                    <Text style={styles.usersTitle}>👥 Users ({users.length})</Text>
                    {users.map((user, index) => (
                        <View key={index} style={styles.userItem}>
                            <Text style={styles.userName}>{user.fullName}</Text>
                            <Text style={styles.userEmail}>{user.email}</Text>
                            <Text style={styles.userRole}>Role: {user.role}</Text>
                        </View>
                    ))}
                </View>
            )}

            <Text style={styles.hint}>
                Make sure your backend is running at: {'\n'}
                http://10.0.2.2:8080 (Android Emulator)
            </Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4CAF50',
        textAlign: 'center',
        marginVertical: 20,
    },
    statusCard: {
        backgroundColor: '#1a1a2e',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#2a2a4a',
    },
    statusLabel: {
        color: '#888',
        fontSize: 14,
        marginBottom: 4,
    },
    statusValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    success: {
        color: '#4CAF50',
    },
    error: {
        color: '#FF4444',
    },
    messageCard: {
        backgroundColor: '#1a1a2e',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    messageText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
    },
    buttonContainer: {
        gap: 12,
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#4CAF50',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonSecondary: {
        backgroundColor: '#2a2a4a',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    usersCard: {
        backgroundColor: '#1a1a2e',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2a2a4a',
    },
    usersTitle: {
        color: '#4CAF50',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    userItem: {
        backgroundColor: '#0a0a1a',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#2a2a4a',
    },
    userName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    userEmail: {
        color: '#888',
        fontSize: 14,
    },
    userRole: {
        color: '#4CAF50',
        fontSize: 12,
        marginTop: 4,
    },
    hint: {
        color: '#666',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 20,
        paddingBottom: 40,
    },
});

export default TestConnectionScreen;