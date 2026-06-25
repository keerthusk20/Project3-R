import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import ProfileCompletionModal from '../components/ProfileCompletionModal';

interface ProfilePageProps {
    user: UserProfile;
    onPhotoUpdated: (url: string) => void;
}

/**
 * ProfilePage renders the profile panel inside the app shell, below the navbar.
 * Navigates back to "/" on close or after save.
 */
const ProfilePage: React.FC<ProfilePageProps> = ({ user, onPhotoUpdated }) => {
    const navigate = useNavigate();

    const handleClose = () => {
        navigate('/');
    };

    return (
        <div className="min-h-full bg-background text-foreground flex items-start justify-center px-4 py-6 md:px-6 md:py-8 animate-fade-in relative">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
            </div>
            <ProfileCompletionModal
                user={user}
                forced={false}
                inline
                onClose={handleClose}
                onSaved={() => navigate('/')}
                onPhotoUpdated={(url) => {
                    onPhotoUpdated(url);
                }}
            />
        </div>
    );
};

export default ProfilePage;