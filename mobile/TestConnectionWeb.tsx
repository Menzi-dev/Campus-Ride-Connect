import React, { useState } from 'react';
import apiClient from './src/services/ApiClient';

const TestConnectionScreen = () => {
    const [loading, setLoading] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string>('Not tested');
    const [users, setUsers] = useState<any[]>([]);
    const [backendMessage, setBackendMessage] = useState('');

    const testConnection = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/test/connection');
            setConnectionStatus(`✅ ${response.data.status} - ${response.data.message}`);
            alert(`Success: Connected to ${response.data.database}`);
        } catch (error: any) {
            setConnectionStatus(`❌ Connection Failed: ${error.message}`);
            alert(`Error: Could not connect to backend: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const testHello = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/test/hello');
            setBackendMessage(response.data);
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getUsers = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/users');
            setUsers(response.data);
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>🔗 Backend Connection Test</h1>

            {/* Connection Status */}
            <div style={styles.statusCard}>
                <p style={styles.statusLabel}>Status:</p>
                <p style={{
                    ...styles.statusValue,
                    color: connectionStatus.includes('✅') ? '#4CAF50' : '#FF4444'
                }}>
                    {connectionStatus}
                </p>
            </div>

            {/* Backend Message */}
            {backendMessage ? (
                <div style={styles.messageCard}>
                    <p style={styles.messageText}>{backendMessage}</p>
                </div>
            ) : null}

            {/* Buttons */}
            <div style={styles.buttonContainer}>
                <button
                    style={{...styles.button, ...styles.buttonPrimary}}
                    onClick={testConnection}
                    disabled={loading}
                >
                    {loading ? '⏳ Testing...' : 'Test Connection'}
                </button>

                <button
                    style={{...styles.button, ...styles.buttonSecondary}}
                    onClick={testHello}
                    disabled={loading}
                >
                    Test Hello
                </button>

                <button
                    style={{...styles.button, ...styles.buttonSecondary}}
                    onClick={getUsers}
                    disabled={loading}
                >
                    Get Users
                </button>
            </div>

            {/* Users List */}
            {users.length > 0 && (
                <div style={styles.usersCard}>
                    <h2 style={styles.usersTitle}>👥 Users ({users.length})</h2>
                    {users.map((user, index) => (
                        <div key={index} style={styles.userItem}>
                            <p style={styles.userName}>{user.fullName}</p>
                            <p style={styles.userEmail}>{user.email}</p>
                            <p style={styles.userRole}>Role: {user.role}</p>
                        </div>
                    ))}
                </div>
            )}

            <p style={styles.hint}>
                Backend API: <code style={{ backgroundColor: '#1a1a2e', padding: '4px 8px', borderRadius: '4px' }}>http://localhost:8080/api</code>
            </p>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a',
        color: '#fff',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
        minHeight: '100vh',
    },
    title: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#4CAF50',
        textAlign: 'center',
        marginBottom: '20px',
        marginTop: 0,
    },
    statusCard: {
        backgroundColor: '#1a1a2e',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '16px',
        border: '1px solid #2a2a4a',
    },
    statusLabel: {
        color: '#888',
        fontSize: '14px',
        marginBottom: '4px',
        margin: '0 0 4px 0',
    },
    statusValue: {
        fontSize: '16px',
        fontWeight: 'bold',
        margin: '0',
    },
    messageCard: {
        backgroundColor: '#1a1a2e',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '16px',
        border: '1px solid #4CAF50',
    },
    messageText: {
        color: '#fff',
        fontSize: '16px',
        textAlign: 'center',
        margin: '0',
    },
    buttonContainer: {
        display: 'grid',
        gap: '12px',
        marginBottom: '20px',
    },
    button: {
        padding: '16px',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        border: 'none',
        transition: 'opacity 0.2s',
    } as React.CSSProperties,
    buttonPrimary: {
        backgroundColor: '#4CAF50',
        color: '#fff',
    },
    buttonSecondary: {
        backgroundColor: '#2a2a4a',
        color: '#fff',
    },
    usersCard: {
        backgroundColor: '#1a1a2e',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #2a2a4a',
        marginBottom: '20px',
    },
    usersTitle: {
        color: '#4CAF50',
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '12px',
        marginTop: 0,
    },
    userItem: {
        backgroundColor: '#0a0a1a',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '8px',
        border: '1px solid #2a2a4a',
    },
    userName: {
        color: '#fff',
        fontSize: '16px',
        fontWeight: 'bold',
        margin: '0 0 8px 0',
    },
    userEmail: {
        color: '#888',
        fontSize: '14px',
        margin: '0 0 4px 0',
    },
    userRole: {
        color: '#4CAF50',
        fontSize: '12px',
        marginTop: '4px',
        margin: '4px 0 0 0',
    },
    hint: {
        color: '#666',
        fontSize: '12px',
        textAlign: 'center',
        marginTop: '20px',
        paddingBottom: '40px',
    },
};

export default TestConnectionScreen;
